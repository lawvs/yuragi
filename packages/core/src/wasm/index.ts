import type { FontAxes, TextOutline } from "../types";
import {
  YuragiWasmRuntime,
  type YuragiFontInfo,
  type YuragiRuntime,
} from "./runtime";

export { YuragiWasmRuntime };
export type { YuragiFontInfo, YuragiRuntime };
export type { FontAxes, FontAxisTag, KnownFontAxisTag } from "../types";

export type BinarySource =
  | string
  | URL
  | ArrayBuffer
  | Uint8Array
  | (() => BinarySource | Promise<BinarySource>);

export type CompileOptions = {
  axes?: FontAxes;
};

export type YuragiFont = {
  readonly info: YuragiFontInfo;
  compile(text: string, options?: CompileOptions): TextOutline;
  preload(texts?: readonly string[]): void;
  dispose(): void;
};

export type CreateYuragiFontOptions = {
  font: BinarySource;
  axes?: FontAxes;
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

function stableAxesKey(axes: FontAxes) {
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
  #axes: FontAxes;
  #cache = new Map<string, TextOutline>();

  constructor(
    runtime: YuragiRuntime,
    info: YuragiFontInfo,
    axes: FontAxes,
  ) {
    this.#runtime = runtime;
    this.info = info;
    this.#axes = axes;
  }

  compile(text: string, options: CompileOptions = {}) {
    const runtime = this.#runtime;
    if (!runtime) {
      throw new Error("Cannot compile after YuragiFont has been disposed");
    }

    const axes = options.axes ?? this.#axes;
    const cacheKey = `${stableAxesKey(axes)}\n${text}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    const compiled = runtime.compileTitle(text, axes);
    this.#cache.set(cacheKey, compiled);
    return compiled;
  }

  preload(texts: readonly string[] = []) {
    for (const text of texts) this.compile(text);
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
  const axes: FontAxes = options.axes ?? {};
  const runtime =
    options.runtime ??
    (await YuragiWasmRuntime.load(
      await resolveBinarySource(options.wasm ?? DEFAULT_WASM_SOURCE, fetchImpl),
    ));
  const fontBytes = await resolveBinarySource(options.font, fetchImpl);
  const info = runtime.setFont(fontBytes);
  const font = new RuntimeYuragiFont(runtime, info, axes);

  if (options.preload) {
    font.preload(options.preload);
  }

  return font;
}
