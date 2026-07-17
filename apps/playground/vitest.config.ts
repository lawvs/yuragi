import { defineConfig } from "vitest/config";

const wasmCompilerAsset = new URL(
  "../../packages/wasm/wasm/yuragi_wasm_compiler.wasm",
  import.meta.url,
).pathname;

export default defineConfig({
  resolve: {
    alias: {
      "@yuragi-labs/react/static": new URL(
        "../../packages/react/src/static.ts",
        import.meta.url,
      ).pathname,
      "@yuragi-labs/react": new URL(
        "../../packages/react/src/index.ts",
        import.meta.url,
      ).pathname,
      "@yuragi-labs/wasm/runtime": new URL(
        "../../packages/wasm/src/runtime.ts",
        import.meta.url,
      ).pathname,
      "@yuragi-labs/wasm/yuragi_wasm_compiler.wasm?url":
        `${wasmCompilerAsset}?url`,
      "@yuragi-labs/wasm/yuragi_wasm_compiler.wasm": wasmCompilerAsset,
      "@yuragi-labs/wasm": new URL(
        "../../packages/wasm/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
