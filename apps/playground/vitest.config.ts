import { defineConfig } from "vitest/config";

const wasmCompilerAsset = new URL(
  "../../packages/core/wasm/yuragi_wasm_compiler.wasm",
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
      "@yuragi-labs/core/wasm/yuragi_wasm_compiler.wasm?url":
        `${wasmCompilerAsset}?url`,
      "@yuragi-labs/core/wasm/yuragi_wasm_compiler.wasm": wasmCompilerAsset,
      "@yuragi-labs/core/wasm": new URL(
        "../../packages/core/src/wasm/index.ts",
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
