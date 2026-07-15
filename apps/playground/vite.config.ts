import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolvePlaygroundFont } from "./playground-font";

export default defineConfig(async ({ command }) => {
  const font = command === "serve" ? await resolvePlaygroundFont() : "";

  return {
    define: {
      "import.meta.env.YURAGI_PLAYGROUND_FONT_URL": JSON.stringify(
        font ? `/@fs/${font.replaceAll("\\", "/")}` : "",
      ),
    },
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
    plugins: [react()],
  };
});
