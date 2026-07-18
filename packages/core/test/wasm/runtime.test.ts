import type { TextOutline } from "../../src/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YuragiWasmRuntime } from "../../src/wasm/runtime";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function heap(memory: WebAssembly.Memory) {
  return new Uint8Array(memory.buffer);
}

function bytes(values: number[]) {
  const buffer = new ArrayBuffer(values.length);
  new Uint8Array(buffer).set(values);
  return buffer;
}

describe("YuragiWasmRuntime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls the renamed yuragi wasm ABI exports", async () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    let nextPtr = 8;

    const yuragi_alloc = vi.fn((len: number) => {
      const ptr = nextPtr;
      nextPtr += Math.max(len, 1);
      return ptr;
    });
    const yuragi_free = vi.fn();

    const writeResponse = (outLenPtr: number, value: unknown) => {
      const response = encoder.encode(
        JSON.stringify({ ok: true, value, error: null }),
      );
      const ptr = yuragi_alloc(response.byteLength);
      heap(memory).set(response, ptr);
      new DataView(memory.buffer).setUint32(outLenPtr, response.byteLength, true);
      return ptr;
    };

    const fontInfo = { bytes: 3, unitsPerEm: 1000 };
    const outline: TextOutline = {
      em: 1000,
      ascender: 800,
      descender: -200,
      groups: [
        {
          text: "Yu",
          advance: 320,
          breakAfter: false,
          glyphs: [],
        },
      ],
    };

    const yuragi_set_font = vi.fn(
      (fontPtr: number, fontLen: number, outLenPtr: number) => {
        expect([...heap(memory).slice(fontPtr, fontPtr + fontLen)]).toEqual([
          1, 2, 3,
        ]);
        return writeResponse(outLenPtr, fontInfo);
      },
    );

    const yuragi_compile_title = vi.fn(
      (
        textPtr: number,
        textLen: number,
        axesPtr: number,
        axesLen: number,
        outLenPtr: number,
      ) => {
        const text = decoder.decode(heap(memory).slice(textPtr, textPtr + textLen));
        const axes = decoder.decode(heap(memory).slice(axesPtr, axesPtr + axesLen));

        expect(text).toBe("Yuragi");
        expect(JSON.parse(axes)).toEqual({ wght: 700 });

        return writeResponse(outLenPtr, outline);
      },
    );

    const instance = {
      exports: {
        memory,
        yuragi_alloc,
        yuragi_free,
        yuragi_set_font,
        yuragi_compile_title,
      },
    } as unknown as WebAssembly.Instance;

    const instantiate = vi.fn(async () => ({
      instance,
      module: {} as WebAssembly.Module,
    }));
    vi.stubGlobal("WebAssembly", {
      ...WebAssembly,
      Memory: WebAssembly.Memory,
      instantiate,
    });

    const runtime = await YuragiWasmRuntime.load(bytes([0]));

    expect(instantiate).toHaveBeenCalledWith(expect.any(ArrayBuffer), {});
    expect(runtime.setFont(bytes([1, 2, 3]))).toEqual(fontInfo);
    expect(runtime.compileTitle("Yuragi", { wght: 700 })).toEqual(outline);

    expect(yuragi_alloc).toHaveBeenCalled();
    expect(yuragi_free).toHaveBeenCalled();
    expect(yuragi_set_font).toHaveBeenCalledWith(
      expect.any(Number),
      3,
      expect.any(Number),
    );
    expect(yuragi_compile_title).toHaveBeenCalledWith(
      expect.any(Number),
      6,
      expect.any(Number),
      12,
      expect.any(Number),
    );
  });
});
