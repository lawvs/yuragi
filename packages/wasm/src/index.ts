import type { TextOutline } from "@yuragi/core";
import {
  YuragiWasmRuntime,
  type YuragiFontInfo,
  type YuragiRuntime,
} from "./runtime";

export { YuragiWasmRuntime };
export type { YuragiFontInfo, YuragiRuntime };

export type BinarySource =
  | string
  | URL
  | ArrayBuffer
  | Uint8Array
  | (() => BinarySource | Promise<BinarySource>);

export type CompileOptions = {
  axes?: Record<string, number>;
};

export type YuragiFont = {
  readonly info: YuragiFontInfo;
  compile(text: string, options?: CompileOptions): Promise<TextOutline>;
  preload(texts?: readonly string[]): Promise<void>;
  dispose(): void;
};

export type CreateYuragiFontOptions = {
  font: BinarySource;
  axes?: Record<string, number>;
  wasm?: BinarySource;
  preload?: readonly string[];
  fetch?: typeof fetch;
  runtime?: YuragiRuntime;
};

const DEFAULT_WASM_SOURCE = new URL(
  "./yuragi_wasm_compiler.wasm",
  import.meta.url,
);

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array) {
  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function resolveBinarySource(
  source: BinarySource,
  fetchImpl: typeof fetch | undefined,
): Promise<ArrayBuffer> {
  const resolved =
    typeof source === "function" ? await source() : source;

  if (typeof resolved === "function") {
    return resolveBinarySource(resolved, fetchImpl);
  }

  if (typeof resolved === "string" || resolved instanceof URL) {
    if (!fetchImpl) {
      throw new Error("A fetch implementation is required to load URL sources");
    }

    const response = await fetchImpl(resolved);
    if (!response.ok) {
      throw new Error(
        `Failed to load yuragi asset: ${response.status} ${response.statusText}`,
      );
    }

    return response.arrayBuffer();
  }

  return toArrayBuffer(resolved);
}

function stableAxesKey(axes: Record<string, number>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(axes).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}

class RuntimeYuragiFont implements YuragiFont {
  readonly info: YuragiFontInfo;
  #runtime: YuragiRuntime | null;
  #axes: Record<string, number>;
  #cache = new Map<string, Promise<TextOutline>>();

  constructor(
    runtime: YuragiRuntime,
    info: YuragiFontInfo,
    axes: Record<string, number>,
  ) {
    this.#runtime = runtime;
    this.info = info;
    this.#axes = axes;
  }

  async compile(text: string, options: CompileOptions = {}) {
    const runtime = this.#runtime;
    if (!runtime) {
      throw new Error("Cannot compile after YuragiFont has been disposed");
    }

    const axes = options.axes ?? this.#axes;
    const cacheKey = `${stableAxesKey(axes)}\n${text}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const compiled = Promise.resolve(runtime.compileTitle(text, axes));
    this.#cache.set(cacheKey, compiled);
    return compiled;
  }

  async preload(texts: readonly string[] = []) {
    await Promise.all(texts.map((text) => this.compile(text)));
  }

  dispose() {
    this.#runtime = null;
    this.#cache.clear();
  }
}

export async function createYuragiFont(
  options: CreateYuragiFontOptions,
): Promise<YuragiFont> {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  const axes = options.axes ?? {};
  const runtime =
    options.runtime ??
    (await YuragiWasmRuntime.load(
      await resolveBinarySource(options.wasm ?? DEFAULT_WASM_SOURCE, fetchImpl),
    ));
  const fontBytes = await resolveBinarySource(options.font, fetchImpl);
  const info = runtime.setFont(fontBytes);
  const font = new RuntimeYuragiFont(runtime, info, axes);

  if (options.preload) {
    await font.preload(options.preload);
  }

  return font;
}
