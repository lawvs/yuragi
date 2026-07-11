import { YuragiWasmRuntime } from "@yuragi/wasm/runtime";
import type { FontAxes, TextOutline } from "@yuragi/core";

type LoadWasmMessage = {
  type: "load-wasm";
  wasmUrl: string;
};

type LoadRemoteFontMessage = {
  type: "load-remote-font";
  fontUrl: string;
};

type LoadLocalFontMessage = {
  type: "load-local-font";
  fontBytes: ArrayBuffer;
};

type CompileMessage = {
  type: "compile";
  text: string;
  axes: FontAxes;
  requestId?: string;
};

type CompileGlyphsMessage = {
  type: "compile-glyphs";
  glyphs: string[];
  axes: FontAxes;
  requestId: string;
};

type IncomingMessage =
  | LoadWasmMessage
  | LoadRemoteFontMessage
  | LoadLocalFontMessage
  | CompileMessage
  | CompileGlyphsMessage;

let runtime: YuragiWasmRuntime | undefined;
let wasmBytes = 0;
let fontBytes = 0;

function post(type: string, payload: Record<string, unknown>) {
  self.postMessage({ type, ...payload });
}

function duration(start: number) {
  return performance.now() - start;
}

async function loadWasm(wasmUrl: string) {
  const start = performance.now();
  const response = await fetch(wasmUrl);

  if (!response.ok) {
    throw new Error(
      `failed to load WASM: ${response.status} ${response.statusText}`,
    );
  }

  const bytes = await response.arrayBuffer();
  runtime = await YuragiWasmRuntime.load(bytes);
  wasmBytes = bytes.byteLength;
  post("wasm-ready", {
    wasmBytes,
    wasmLoadMs: duration(start),
  });
}

async function setFont(bytes: ArrayBuffer, loadStart: number) {
  if (!runtime) {
    throw new Error("load the WASM compiler before loading a font");
  }

  const info = runtime.setFont(bytes);
  fontBytes = info.bytes;
  post("font-ready", {
    fontBytes,
    fontLoadMs: duration(loadStart),
    unitsPerEm: info.unitsPerEm,
  });
}

async function loadRemoteFont(fontUrl: string) {
  const start = performance.now();
  const response = await fetch(fontUrl);

  if (!response.ok) {
    throw new Error(
      `failed to load font: ${response.status} ${response.statusText}`,
    );
  }

  await setFont(await response.arrayBuffer(), start);
}

function compile(text: string, axes: FontAxes, requestId?: string) {
  if (!runtime) {
    throw new Error("load the WASM compiler before compiling text");
  }
  if (fontBytes === 0) {
    throw new Error("load a font before compiling text");
  }

  const start = performance.now();
  const outline = runtime.compileTitle(text, axes);
  const outlineBytes = new TextEncoder().encode(JSON.stringify(outline)).length;
  post("compiled", {
    requestId,
    outline,
    compileMs: duration(start),
    outlineBytes,
    wasmBytes,
    fontBytes,
  });
}

function compileGlyphs(
  glyphs: string[],
  axes: FontAxes,
  requestId: string,
) {
  if (!runtime) {
    throw new Error("load the WASM compiler before compiling text");
  }
  if (fontBytes === 0) {
    throw new Error("load a font before compiling text");
  }

  const start = performance.now();
  const encoder = new TextEncoder();
  const results: Array<{
    glyph: string;
    outline?: TextOutline;
    error?: string;
  }> = [];
  let outlineBytes = 0;

  for (const glyph of glyphs) {
    try {
      const outline = runtime.compileTitle(glyph, axes);
      outlineBytes += encoder.encode(JSON.stringify(outline)).length;
      results.push({ glyph, outline });
    } catch (error) {
      results.push({
        glyph,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  post("glyphs-compiled", {
    requestId,
    results,
    compileMs: duration(start),
    outlineBytes,
    wasmBytes,
    fontBytes,
  });
}

self.addEventListener("message", (event: MessageEvent<IncomingMessage>) => {
  void (async () => {
    const message = event.data;

    switch (message.type) {
      case "load-wasm":
        await loadWasm(message.wasmUrl);
        break;
      case "load-remote-font":
        await loadRemoteFont(message.fontUrl);
        break;
      case "load-local-font":
        await setFont(message.fontBytes, performance.now());
        break;
      case "compile":
        compile(message.text, message.axes, message.requestId);
        break;
      case "compile-glyphs":
        compileGlyphs(message.glyphs, message.axes, message.requestId);
        break;
    }
  })().catch((error) => {
    post("error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
