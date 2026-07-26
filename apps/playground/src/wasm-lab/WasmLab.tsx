import { useMemo, useState } from "react";
import { YuragiText } from "@yuragi-labs/react/static";
import "./WasmLab.css";
import {
  DEFAULT_FONT_PRESET_ID,
  FONT_PRESETS,
  findFontPreset,
} from "./config";
import { formatBytes, summarizeCompileMetrics } from "./metrics";
import { useWasmLabCompiler, type LabStatus } from "./useWasmLabCompiler";

const defaultFontPreset = findFontPreset(DEFAULT_FONT_PRESET_ID);

function statusMessage(status: LabStatus) {
  switch (status) {
    case "idle":
      return "Waiting for compiler and font.";
    case "loading":
      return "Loading compiler and font…";
    case "ready":
      return "Ready. Edit the title, then compile an outline.";
    case "compiling":
      return "Compiling outline…";
    case "error":
      return "Resolve the error, then load the compiler and font again.";
  }
}

export function WasmLab() {
  const [selectedPresetId, setSelectedPresetId] = useState(
    DEFAULT_FONT_PRESET_ID,
  );
  const [text, setText] = useState(defaultFontPreset.sampleText);
  const [fontUrl, setFontUrl] = useState(defaultFontPreset.url);
  const {
    compile,
    error,
    loadLocalFont,
    loadRemoteFont,
    metrics,
    outline,
    reset,
    status,
  } = useWasmLabCompiler();
  const rows = useMemo(() => summarizeCompileMetrics(metrics), [metrics]);

  function loadDefaultFont() {
    loadRemoteFont(fontUrl);
  }

  function compileTitle() {
    const preset = findFontPreset(selectedPresetId);
    compile({
      text,
      axes: preset.axes,
    });
  }

  async function handleLocalFont(file: File | undefined) {
    if (!file) return;
    await loadLocalFont(file);
  }

  function selectFontPreset(id: string) {
    const preset = findFontPreset(id);
    setSelectedPresetId(preset.id);
    setText(preset.sampleText);
    setFontUrl(preset.url);
    reset();
  }

  const canCompile = status === "ready" && text.trim().length > 0;
  const canLoadRemoteFont = fontUrl.trim().length > 0;
  const remoteFontReadonly = selectedPresetId !== "custom";
  const compileHint = canCompile
    ? "Compile the current title to update the preview."
    : "Compile is available after the compiler and font are loaded.";

  return (
    <section className="wasm-lab" aria-label="WASM Lab">
      <div className="wasm-lab-header">
        <div>
          <p className="eyebrow">wasm test tool</p>
          <h2>WASM Lab</h2>
        </div>
        <div className="wasm-lab-actions">
          <button
            type="button"
            onClick={loadDefaultFont}
            disabled={!canLoadRemoteFont}
          >
            1. Load compiler and font
          </button>
          <button type="button" onClick={compileTitle} disabled={!canCompile}>
            2. Compile title
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
              onChange={(event) => setFontUrl(event.target.value)}
            />
          </label>

          <label>
            <span>Local font</span>
            <input
              name="wasm-local-font"
              type="file"
              accept=".otf,.ttf,.woff,.woff2,font/*"
              onChange={(event) => {
                void handleLocalFont(event.target.files?.[0]);
              }}
            />
          </label>

          <p className="wasm-lab-flow">
            Load the compiler and selected font before compiling.
          </p>
          <p className="wasm-lab-status" data-status={status}>
            {statusMessage(status)}
          </p>
          <p className="wasm-lab-hint">{compileHint}</p>

          {error ? <p className="wasm-lab-error">{error}</p> : null}
        </section>

        <section
          className="wasm-lab-preview"
          aria-label="Compiled outline preview"
        >
          <YuragiText
            text={text}
            outline={outline}
            size={86}
            maxWidth={760}
            fallback="text"
            hover="outline"
            animation={{ exit: false }}
          />
          <p>
            {outline
              ? `Compiled outline: ${formatBytes(metrics.outlineBytes ?? 0)}`
              : "Fallback text is shown until an outline is compiled."}
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
