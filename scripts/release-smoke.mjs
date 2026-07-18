import { readFile } from "node:fs/promises";

const [core, coreWasm, coreWasmRuntime, compiler, react, reactStatic] =
  await Promise.all([
    import("@yuragi-labs/core"),
    import("@yuragi-labs/core/wasm"),
    import("@yuragi-labs/core/wasm/runtime"),
    import("@yuragi-labs/compiler"),
    import("@yuragi-labs/react"),
    import("@yuragi-labs/react/static"),
  ]);

for (const [name, value] of [
  ["@yuragi-labs/core#createShardedSvg", core.createShardedSvg],
  ["@yuragi-labs/core/wasm#createYuragiFont", coreWasm.createYuragiFont],
  [
    "@yuragi-labs/core/wasm/runtime#YuragiWasmRuntime",
    coreWasmRuntime.YuragiWasmRuntime,
  ],
  ["@yuragi-labs/compiler#compileOutlines", compiler.compileOutlines],
  ["@yuragi-labs/react#YuragiFontProvider", react.YuragiFontProvider],
  ["@yuragi-labs/react/static#YuragiText", reactStatic.YuragiText],
]) {
  if (typeof value !== "function") {
    throw new Error(name + " is not a function");
  }
}

const wasmUrl = import.meta.resolve(
  "@yuragi-labs/core/wasm/yuragi_wasm_compiler.wasm",
);
const wasmModule = await WebAssembly.compile(await readFile(new URL(wasmUrl)));
const wasmExports = new Map(
  WebAssembly.Module.exports(wasmModule).map(({ name, kind }) => [name, kind]),
);

for (const [name, kind] of [
  ["memory", "memory"],
  ["yuragi_alloc", "function"],
  ["yuragi_free", "function"],
  ["yuragi_set_font", "function"],
  ["yuragi_compile_title", "function"],
]) {
  if (wasmExports.get(name) !== kind) {
    throw new Error(
      "@yuragi-labs/core/wasm expected " + name + " to be a " + kind + " export",
    );
  }
}

console.log("Release tarball smoke test passed.");
