import type { TextOutline } from "@type-shards/core";
import {
  TypeShardsWasmRuntime,
  type TypeShardsFontInfo,
  type TypeShardsRuntime,
} from "./runtime";

export { TypeShardsWasmRuntime };
export type { TypeShardsFontInfo, TypeShardsRuntime };

export type BinarySource =
  | string
  | URL
  | ArrayBuffer
  | Uint8Array
  | (() => BinarySource | Promise<BinarySource>);

export type CompileOptions = {
  axes?: Record<string, number>;
};

export type TypeShardsFont = {
  readonly info: TypeShardsFontInfo;
  compile(text: string, options?: CompileOptions): Promise<TextOutline>;
  preload(texts?: readonly string[]): Promise<void>;
  dispose(): void;
};

export type CreateTypeShardsFontOptions = {
  font: BinarySource;
  axes?: Record<string, number>;
  wasm?: BinarySource;
  preload?: readonly string[];
  fetch?: typeof fetch;
  runtime?: TypeShardsRuntime;
};

const DEFAULT_WASM_SOURCE = new URL(
  "./type_shards_wasm_compiler.wasm",
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
        `Failed to load type-shards asset: ${response.status} ${response.statusText}`,
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

class RuntimeTypeShardsFont implements TypeShardsFont {
  readonly info: TypeShardsFontInfo;
  #runtime: TypeShardsRuntime | null;
  #axes: Record<string, number>;
  #cache = new Map<string, Promise<TextOutline>>();

  constructor(
    runtime: TypeShardsRuntime,
    info: TypeShardsFontInfo,
    axes: Record<string, number>,
  ) {
    this.#runtime = runtime;
    this.info = info;
    this.#axes = axes;
  }

  async compile(text: string, options: CompileOptions = {}) {
    const runtime = this.#runtime;
    if (!runtime) {
      throw new Error("Cannot compile after TypeShardsFont has been disposed");
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

export async function createTypeShardsFont(
  options: CreateTypeShardsFontOptions,
): Promise<TypeShardsFont> {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  const axes = options.axes ?? {};
  const runtime =
    options.runtime ??
    (await TypeShardsWasmRuntime.load(
      await resolveBinarySource(options.wasm ?? DEFAULT_WASM_SOURCE, fetchImpl),
    ));
  const fontBytes = await resolveBinarySource(options.font, fetchImpl);
  const info = runtime.setFont(fontBytes);
  const font = new RuntimeTypeShardsFont(runtime, info, axes);

  if (options.preload) {
    await font.preload(options.preload);
  }

  return font;
}
