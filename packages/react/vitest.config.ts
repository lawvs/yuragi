import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@yuragi-labs/core/wasm",
        replacement: new URL("../core/src/wasm/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@yuragi-labs/core",
        replacement: new URL("../core/src/index.ts", import.meta.url).pathname,
      },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
  },
});
