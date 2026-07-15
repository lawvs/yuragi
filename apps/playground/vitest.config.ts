import { defineConfig } from "vitest/config";

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
