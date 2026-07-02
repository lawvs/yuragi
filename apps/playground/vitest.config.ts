import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@yuragi/react/wasm": new URL(
        "../../packages/react/src/wasm.tsx",
        import.meta.url,
      ).pathname,
      "@yuragi/react": new URL(
        "../../packages/react/src/index.ts",
        import.meta.url,
      ).pathname,
      "@yuragi/wasm/runtime": new URL(
        "../../packages/wasm/src/runtime.ts",
        import.meta.url,
      ).pathname,
      "@yuragi/wasm": new URL(
        "../../packages/wasm/src/index.ts",
        import.meta.url,
      ).pathname,
      "virtual:yuragi/outlines": new URL(
        "./src/test-outlines.ts",
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
