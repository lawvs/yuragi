import { useEffect, useMemo, useRef, useState } from "react";
import type { TextOutline } from "@yuragi/core";
import { YuragiText } from "@yuragi/react/static";
import {
  DEFAULT_FONT_PRESET_ID,
  DEFAULT_WASM_URL,
  FONT_PRESETS,
  findFontPreset,
} from "./config";
import {
  type CompileMetrics,
  formatBytes,
  summarizeCompileMetrics,
} from "./metrics";

type LabStatus = "idle" | "loading" | "ready" | "compiling" | "error";

type WorkerMessage =
  | {
      type: "wasm-ready";
      wasmBytes: number;
      wasmLoadMs: number;
    }
  | {
      type: "font-ready";
      fontBytes: number;
      fontLoadMs: number;
      unitsPerEm: number;
    }
  | {
      type: "compiled";
      requestId?: string;
      outline: TextOutline;
      compileMs: number;
      outlineBytes: number;
      wasmBytes: number;
      fontBytes: number;
    }
  | {
      type: "error";
      message: string;
    };

const defaultFontPreset = findFontPreset(DEFAULT_FONT_PRESET_ID);

export function WasmLab() {
  const workerRef = useRef<Worker | null>(null);
  const pendingFontRef = useRef<
    | { type: "remote"; fontUrl: string }
    | { type: "local"; fontBytes: ArrayBuffer }
    | null
  >(null);
  const fontUrlRef = useRef(defaultFontPreset.url);
  const [selectedPresetId, setSelectedPresetId] = useState(
    DEFAULT_FONT_PRESET_ID,
  );
  const [text, setText] = useState(defaultFontPreset.sampleText);
  const [fontUrl, setFontUrl] = useState(defaultFontPreset.url);
  const [status, setStatus] = useState<LabStatus>("idle");
  const [error, setError] = useState("");
  const [outline, setOutline] = useState<TextOutline | undefined>();
  const [metrics, setMetrics] = useState<CompileMetrics>({
    usedFallback: true,
  });
  const rows = useMemo(() => summarizeCompileMetrics(metrics), [metrics]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setError("Web Worker is not available in this browser.");
      setStatus("error");
      return;
    }

    const worker = new Worker(new URL("./wasm-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "wasm-ready") {
        setMetrics((current) => ({
          ...current,
          wasmBytes: message.wasmBytes,
          wasmLoadMs: message.wasmLoadMs,
        }));
        const pendingFont = pendingFontRef.current ?? {
          type: "remote" as const,
          fontUrl: fontUrlRef.current,
        };

        if (pendingFont.type === "local") {
          worker.postMessage(
            { type: "load-local-font", fontBytes: pendingFont.fontBytes },
            [pendingFont.fontBytes],
          );
        } else {
          worker.postMessage({
            type: "load-remote-font",
            fontUrl: pendingFont.fontUrl,
          });
        }
        return;
      }

      if (message.type === "font-ready") {
        setMetrics((current) => ({
          ...current,
          fontBytes: message.fontBytes,
          fontLoadMs: message.fontLoadMs,
        }));
        setStatus("ready");
        return;
      }

      if (message.type === "compiled") {
        setOutline(message.outline);
        setMetrics((current) => ({
          ...current,
          wasmBytes: message.wasmBytes,
          fontBytes: message.fontBytes,
          compileMs: message.compileMs,
          outlineBytes: message.outlineBytes,
          usedFallback: false,
        }));
        setStatus("ready");
        return;
      }

      setError(message.message);
      setStatus("error");
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function loadDefaultFont() {
    setError("");
    setOutline(undefined);
    setStatus("loading");
    setMetrics({ usedFallback: true });
    pendingFontRef.current = { type: "remote", fontUrl };
    workerRef.current?.postMessage({
      type: "load-wasm",
      wasmUrl: DEFAULT_WASM_URL,
    });
  }

  function compileTitle() {
    const preset = findFontPreset(selectedPresetId);
    setError("");
    setStatus("compiling");
    setMetrics((current) => ({ ...current, usedFallback: true }));
    workerRef.current?.postMessage({
      type: "compile",
      text,
      axes: preset.axes,
    });
  }

  async function loadLocalFont(file: File | undefined) {
    if (!file) return;

    setError("");
    setOutline(undefined);
    setStatus("loading");
    setMetrics({ usedFallback: true });
    pendingFontRef.current = {
      type: "local",
      fontBytes: await file.arrayBuffer(),
    };
    workerRef.current?.postMessage({
      type: "load-wasm",
      wasmUrl: DEFAULT_WASM_URL,
    });
  }

  function selectFontPreset(id: string) {
    const preset = findFontPreset(id);
    setSelectedPresetId(preset.id);
    setText(preset.sampleText);
    setFontUrl(preset.url);
    fontUrlRef.current = preset.url;
    setOutline(undefined);
    setError("");
    setStatus("idle");
    setMetrics({ usedFallback: true });
  }

  const canCompile = status === "ready" && text.trim().length > 0;
  const canLoadRemoteFont = fontUrl.trim().length > 0;
  const remoteFontReadonly = selectedPresetId !== "custom";

  return (
    <section className="wasm-lab" aria-label="WASM Lab">
      <div className="wasm-lab-header">
        <div>
          <p className="eyebrow">yuragi experiment</p>
          <h2>WASM Lab</h2>
        </div>
        <div className="wasm-lab-actions">
          <button
            type="button"
            onClick={loadDefaultFont}
            disabled={!canLoadRemoteFont}
          >
            Load compiler and font
          </button>
          <button type="button" onClick={compileTitle} disabled={!canCompile}>
            Compile title
          </button>
        </div>
      </div>

      <div className="wasm-lab-grid">
        <section className="wasm-lab-controls" aria-label="WASM controls">
          <label>
            <span>Font preset</span>
            <select
              name="wasm-font-preset"
              value={selectedPresetId}
              onChange={(event) => selectFontPreset(event.target.value)}
            >
              {FONT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Title</span>
            <input
              name="wasm-title"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>

          <label>
            <span>Remote font</span>
            <input
              name="wasm-font-url"
              value={fontUrl}
              readOnly={remoteFontReadonly}
              onChange={(event) => {
                fontUrlRef.current = event.target.value;
                setFontUrl(event.target.value);
              }}
            />
          </label>

          <label>
            <span>Local font</span>
            <input
              name="wasm-local-font"
              type="file"
              accept=".otf,.ttf,.woff,.woff2,font/*"
              onChange={(event) => {
                void loadLocalFont(event.target.files?.[0]);
              }}
            />
          </label>

          <p className="wasm-lab-status" data-status={status}>
            {status === "idle"
              ? "Build the WASM lab, then load the compiler."
              : status}
          </p>

          {error ? <p className="wasm-lab-error">{error}</p> : null}
        </section>

        <section className="wasm-lab-preview" aria-label="Runtime preview">
          <YuragiText
            text={text}
            outline={outline}
            size={86}
            maxWidth={760}
            fallback="text"
            hover="outline"
            transition={{
              enter: "settle",
              exit: "scatter",
              speed: 1,
            }}
          />
          <p>
            {outline
              ? `Runtime outline: ${formatBytes(metrics.outlineBytes ?? 0)}`
              : "Fallback text is shown until the runtime outline is ready."}
          </p>
        </section>
      </div>

      <dl className="wasm-metrics" aria-label="WASM metrics">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            <span>{row.detail}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}
