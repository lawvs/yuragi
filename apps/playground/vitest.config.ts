import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@yuragi/react/static": new URL(
        "../../packages/react/src/static.ts",
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
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
