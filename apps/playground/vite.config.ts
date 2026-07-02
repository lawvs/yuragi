import react from "@vitejs/plugin-react";
import TypeShards from "@yuragi/unplugin/vite";
import { defineConfig } from "vite";
import { resolvePlaygroundFont } from "./playground-font";
import { outlineTitles } from "./src/data";

const font = await resolvePlaygroundFont();

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
