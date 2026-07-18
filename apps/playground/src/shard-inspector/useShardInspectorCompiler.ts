import { useEffect, useRef, useState } from "react";
import type { FontAxes, TextOutline } from "@yuragi-labs/core";
import { createInspectorGlyph, type InspectorGlyph } from "./model";

export type InspectorStatus =
  | "loading-wasm"
  | "loading-font"
  | "ready"
  | "compiling"
  | "idle"
  | "error";

type WorkerMessage =
  | { type: "wasm-ready" }
  | {
      type: "font-ready";
      loadId?: string;
    }
  | {
      type: "glyphs-compiled";
      requestId: string;
      results: Array<{
        glyph: string;
        outline?: TextOutline;
      }>;
      compileMs: number;
    }
  | { type: "error"; message: string; loadId?: string };

type PendingFont =
  | { type: "remote"; fontUrl: string }
  | { type: "local"; fontBytes: ArrayBuffer };

type CompileContext = {
  axes: FontAxes;
  glyphs: readonly string[];
};

export function useShardInspectorCompiler({
  initialAxes,
  initialFont,
  initialGlyphs,
  wasmUrl,
}: {
  wasmUrl: string;
  initialFont: PendingFont;
  initialAxes: FontAxes;
  initialGlyphs: readonly string[];
}) {
  const workerRef = useRef<Worker | null>(null);
  const pendingFontRef = useRef<PendingFont | null>(initialFont);
  const compileContextRef = useRef<CompileContext>({
    axes: initialAxes,
    glyphs: initialGlyphs,
  });
  const wasmReadyRef = useRef(false);
  const fontIntentSequenceRef = useRef(0);
  const fontLoadSequenceRef = useRef(0);
  const activeFontLoadRef = useRef("");
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef("");
  const [glyphs, setGlyphs] = useState<Map<string, InspectorGlyph>>(
    () => new Map(),
  );
  const [missingGlyphs, setMissingGlyphs] = useState<Set<string>>(
    () => new Set(),
  );
  const [status, setStatus] = useState<InspectorStatus>("loading-wasm");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [compileMs, setCompileMs] = useState<number>();

  function compileGlyphs({ axes, glyphs }: CompileContext) {
    const nextGlyphs = [...glyphs];
    compileContextRef.current = { axes, glyphs: nextGlyphs };
    const requestId = `inspector-${++requestSequenceRef.current}`;
    activeRequestRef.current = requestId;
    setStatus("compiling");
    workerRef.current?.postMessage({
      type: "compile-glyphs",
      requestId,
      glyphs: nextGlyphs,
      axes,
    });
  }

  function loadPendingFont(worker: Worker) {
    const pendingFont = pendingFontRef.current;
    if (!pendingFont) return;
    pendingFontRef.current = null;

    const loadId = `inspector-font-${++fontLoadSequenceRef.current}`;
    activeFontLoadRef.current = loadId;

    if (pendingFont.type === "local") {
      worker.postMessage(
        {
          type: "load-local-font",
          loadId,
          fontBytes: pendingFont.fontBytes,
        },
        [pendingFont.fontBytes],
      );
      return;
    }

    worker.postMessage({
      type: "load-remote-font",
      loadId,
      fontUrl: pendingFont.fontUrl,
    });
  }

  function resetFontState(nextStatus: InspectorStatus) {
    setGlyphs(new Map());
    setMissingGlyphs(new Set());
    setCompileMs(undefined);
    setError("");
    setStatus(nextStatus);
    setReady(false);
    activeRequestRef.current = "";
    activeFontLoadRef.current = "";
  }

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setError("Web Worker is not available in this browser.");
      setStatus("error");
      return;
    }

    const worker = new Worker(
      new URL("../wasm-lab/wasm-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "wasm-ready") {
        wasmReadyRef.current = true;
        if (pendingFontRef.current) {
          setStatus("loading-font");
          loadPendingFont(worker);
        }
        return;
      }

      if (message.type === "font-ready") {
        if (message.loadId !== activeFontLoadRef.current) return;
        setReady(true);
        compileGlyphs(compileContextRef.current);
        return;
      }

      if (message.type === "glyphs-compiled") {
        if (message.requestId !== activeRequestRef.current) return;
        const nextGlyphs = new Map<string, InspectorGlyph>();

        for (const result of message.results) {
          if (!result.outline) continue;
          const data = createInspectorGlyph(result.glyph, result.outline);
          if (data) nextGlyphs.set(result.glyph, data);
        }

        setGlyphs(nextGlyphs);
        setMissingGlyphs(
          new Set(
            compileContextRef.current.glyphs.filter(
              (glyph) => !nextGlyphs.has(glyph),
            ),
          ),
        );
        setCompileMs(message.compileMs);
        setStatus("ready");
        return;
      }

      if (
        message.loadId !== undefined &&
        message.loadId !== activeFontLoadRef.current
      ) {
        return;
      }
      setError(message.message);
      setStatus("error");
    });

    setStatus("loading-wasm");
    worker.postMessage({ type: "load-wasm", wasmUrl });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function resetFont() {
    fontIntentSequenceRef.current += 1;
    pendingFontRef.current = null;
    resetFontState("idle");
  }

  function applyRemoteFont({
    axes,
    fontUrl,
    glyphs,
  }: CompileContext & { fontUrl: string }) {
    if (!fontUrl.trim()) return;
    fontIntentSequenceRef.current += 1;
    compileContextRef.current = { axes, glyphs: [...glyphs] };
    pendingFontRef.current = {
      type: "remote",
      fontUrl,
    };
    resetFontState(wasmReadyRef.current ? "loading-font" : "loading-wasm");
    const worker = workerRef.current;
    if (worker && wasmReadyRef.current) loadPendingFont(worker);
  }

  async function applyLocalFont({
    axes,
    file,
    glyphs,
  }: CompileContext & { file: File }) {
    const intent = ++fontIntentSequenceRef.current;
    pendingFontRef.current = null;
    compileContextRef.current = { axes, glyphs: [...glyphs] };
    resetFontState(wasmReadyRef.current ? "loading-font" : "loading-wasm");
    const fontBytes = await file.arrayBuffer();
    if (intent !== fontIntentSequenceRef.current) return;

    pendingFontRef.current = {
      type: "local",
      fontBytes,
    };
    const worker = workerRef.current;
    if (worker && wasmReadyRef.current) {
      setStatus("loading-font");
      loadPendingFont(worker);
    }
  }

  return {
    status,
    ready,
    error,
    glyphs,
    missingGlyphs,
    compileMs,
    applyRemoteFont,
    applyLocalFont,
    compileGlyphs,
    resetFont,
  };
}
