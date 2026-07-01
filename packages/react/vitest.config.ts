import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@type-shards/wasm": new URL("../wasm/src/index.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
  },
});
