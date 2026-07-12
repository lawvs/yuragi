import react from "@vitejs/plugin-react";
import Yuragi from "@yuragi/unplugin/vite";
import { defineConfig } from "vite";
import { resolvePlaygroundFont } from "./playground-font";
import { outlineTitles } from "./src/data";

const font = await resolvePlaygroundFont();

export default defineConfig(({ command }) => ({
  define: {
    "import.meta.env.YURAGI_PLAYGROUND_FONT_URL": JSON.stringify(
      command === "serve" ? `/@fs/${font.replaceAll("\\", "/")}` : "",
    ),
  },
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
  plugins: [
    react(),
    Yuragi({
      font,
      axes: { wght: 900 },
      titles: outlineTitles,
    }),
  ],
}));
