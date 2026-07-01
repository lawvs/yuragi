import { TypeShardsWasmRuntime } from "@type-shards/wasm/runtime";

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
  axes: Record<string, number>;
};

type IncomingMessage =
  | LoadWasmMessage
  | LoadRemoteFontMessage
  | LoadLocalFontMessage
  | CompileMessage;

let runtime: TypeShardsWasmRuntime | undefined;
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
  runtime = await TypeShardsWasmRuntime.load(bytes);
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

function compile(text: string, axes: Record<string, number>) {
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
    outline,
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
        compile(message.text, message.axes);
        break;
    }
  })().catch((error) => {
    post("error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
