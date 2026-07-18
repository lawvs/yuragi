import type { FontAxes, TextOutline } from "../types";

type WasmExports = {
  memory: WebAssembly.Memory;
  yuragi_alloc(len: number): number;
  yuragi_free(ptr: number, len: number): void;
  yuragi_set_font(
    fontPtr: number,
    fontLen: number,
    outLenPtr: number,
  ): number;
  yuragi_compile_title(
    textPtr: number,
    textLen: number,
    axesPtr: number,
    axesLen: number,
    outLenPtr: number,
  ): number;
};

type ApiResponse<T> = {
  ok: boolean;
  value: T | null;
  error: string | null;
};

export type YuragiFontInfo = {
  bytes: number;
  unitsPerEm: number;
};

export type YuragiRuntime = {
  setFont(fontBytes: ArrayBuffer): YuragiFontInfo;
  compileTitle(text: string, axes: FontAxes): TextOutline;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function exportsOf(instance: WebAssembly.Instance): WasmExports {
  return instance.exports as unknown as WasmExports;
}

function heap(exports: WasmExports) {
  return new Uint8Array(exports.memory.buffer);
}

function copyInput(exports: WasmExports, bytes: Uint8Array) {
  const ptr = exports.yuragi_alloc(bytes.byteLength);
  heap(exports).set(bytes, ptr);
  return ptr;
}

function readResponse<T>(exports: WasmExports, ptr: number, len: number) {
  const bytes = heap(exports).slice(ptr, ptr + len);
  exports.yuragi_free(ptr, len);
  const response = JSON.parse(decoder.decode(bytes)) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(response.error ?? "WASM compiler failed");
  }

  if (response.value === null) {
    throw new Error("WASM compiler returned an empty response");
  }

  return response.value;
}

function callWithResponse<T>(
  exports: WasmExports,
  callback: (outLenPtr: number) => number,
) {
  const outLenPtr = exports.yuragi_alloc(4);
  try {
    const resultPtr = callback(outLenPtr);
    const length = new DataView(exports.memory.buffer).getUint32(
      outLenPtr,
      true,
    );
    return readResponse<T>(exports, resultPtr, length);
  } finally {
    exports.yuragi_free(outLenPtr, 4);
  }
}

export class YuragiWasmRuntime implements YuragiRuntime {
  #exports: WasmExports;

  private constructor(instance: WebAssembly.Instance) {
    this.#exports = exportsOf(instance);
  }

  static async load(wasmBytes: ArrayBuffer) {
    const source = await WebAssembly.instantiate(wasmBytes, {});
    return new YuragiWasmRuntime(source.instance);
  }

  setFont(fontBytes: ArrayBuffer) {
    const input = new Uint8Array(fontBytes);
    const ptr = copyInput(this.#exports, input);

    try {
      return callWithResponse<YuragiFontInfo>(this.#exports, (outLenPtr) =>
        this.#exports.yuragi_set_font(ptr, input.byteLength, outLenPtr),
      );
    } finally {
      this.#exports.yuragi_free(ptr, input.byteLength);
    }
  }

  compileTitle(text: string, axes: FontAxes) {
    const textBytes = encoder.encode(text);
    const axesBytes = encoder.encode(JSON.stringify(axes));
    const textPtr = copyInput(this.#exports, textBytes);
    const axesPtr = copyInput(this.#exports, axesBytes);

    try {
      return callWithResponse<TextOutline>(this.#exports, (outLenPtr) =>
        this.#exports.yuragi_compile_title(
          textPtr,
          textBytes.byteLength,
          axesPtr,
          axesBytes.byteLength,
          outLenPtr,
        ),
      );
    } finally {
      this.#exports.yuragi_free(textPtr, textBytes.byteLength);
      this.#exports.yuragi_free(axesPtr, axesBytes.byteLength);
    }
  }
}
