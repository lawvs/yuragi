import react from "@vitejs/plugin-react";
import TypeShards from "@type-shards/unplugin/vite";
import { defineConfig } from "vite";
import { resolvePlaygroundFont } from "./playground-font";
import { outlineTitles } from "./src/data";

const font = await resolvePlaygroundFont();

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
    },
  },
  plugins: [
    react(),
    TypeShards({
      font,
      axes: { wght: 900 },
      titles: outlineTitles,
    }),
  ],
});
