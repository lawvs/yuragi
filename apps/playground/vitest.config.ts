import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@type-shards/react/wasm": new URL(
        "../../packages/react/src/wasm.tsx",
        import.meta.url,
      ).pathname,
      "@type-shards/react": new URL(
        "../../packages/react/src/index.ts",
        import.meta.url,
      ).pathname,
      "@type-shards/wasm/runtime": new URL(
        "../../packages/wasm/src/runtime.ts",
        import.meta.url,
      ).pathname,
      "@type-shards/wasm": new URL(
        "../../packages/wasm/src/index.ts",
        import.meta.url,
      ).pathname,
      "virtual:type-shards/outlines": new URL(
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
