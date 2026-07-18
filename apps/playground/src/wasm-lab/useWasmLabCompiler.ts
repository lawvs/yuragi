import { useEffect, useRef, useState } from "react";
import type { FontAxes, TextOutline } from "@yuragi-labs/core";
import { DEFAULT_WASM_URL } from "./config";
import type { CompileMetrics } from "./metrics";

export type LabStatus = "idle" | "loading" | "ready" | "compiling" | "error";

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

type PendingFont =
  | { type: "remote"; fontUrl: string }
  | { type: "local"; fontBytes: ArrayBuffer };

function fallbackMetrics(): CompileMetrics {
  return { usedFallback: true };
}

export function useWasmLabCompiler() {
  const workerRef = useRef<Worker | null>(null);
  const pendingFontRef = useRef<PendingFont | null>(null);
  const fontIntentSequenceRef = useRef(0);
  const [status, setStatus] = useState<LabStatus>("idle");
  const [error, setError] = useState("");
  const [outline, setOutline] = useState<TextOutline | undefined>();
  const [metrics, setMetrics] = useState<CompileMetrics>(fallbackMetrics);

  function loadPendingFont(worker: Worker) {
    const pendingFont = pendingFontRef.current;
    if (!pendingFont) return;
    pendingFontRef.current = null;

    if (pendingFont.type === "local") {
      worker.postMessage(
        { type: "load-local-font", fontBytes: pendingFont.fontBytes },
        [pendingFont.fontBytes],
      );
      return;
    }

    worker.postMessage({
      type: "load-remote-font",
      fontUrl: pendingFont.fontUrl,
    });
  }

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
        loadPendingFont(worker);
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

  function reset() {
    fontIntentSequenceRef.current += 1;
    pendingFontRef.current = null;
    setError("");
    setOutline(undefined);
    setStatus("idle");
    setMetrics(fallbackMetrics());
  }

  function startFontLoad(pendingFont: PendingFont) {
    fontIntentSequenceRef.current += 1;
    pendingFontRef.current = pendingFont;
    setError("");
    setOutline(undefined);
    setStatus("loading");
    setMetrics(fallbackMetrics());
    workerRef.current?.postMessage({
      type: "load-wasm",
      wasmUrl: DEFAULT_WASM_URL,
    });
  }

  function loadRemoteFont(fontUrl: string) {
    startFontLoad({ type: "remote", fontUrl });
  }

  async function loadLocalFont(file: File) {
    const intent = ++fontIntentSequenceRef.current;
    pendingFontRef.current = null;
    setError("");
    setOutline(undefined);
    setStatus("loading");
    setMetrics(fallbackMetrics());

    const fontBytes = await file.arrayBuffer();
    if (intent !== fontIntentSequenceRef.current) return;

    pendingFontRef.current = { type: "local", fontBytes };
    workerRef.current?.postMessage({
      type: "load-wasm",
      wasmUrl: DEFAULT_WASM_URL,
    });
  }

  function compile({ axes, text }: { text: string; axes: FontAxes }) {
    setError("");
    setStatus("compiling");
    setMetrics((current) => ({ ...current, usedFallback: true }));
    workerRef.current?.postMessage({
      type: "compile",
      text,
      axes,
    });
  }

  return {
    status,
    error,
    outline,
    metrics,
    loadRemoteFont,
    loadLocalFont,
    compile,
    reset,
  };
}
