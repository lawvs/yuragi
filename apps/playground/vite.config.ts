import react from "@vitejs/plugin-react";
import TypeShards from "@type-shards/unplugin/vite";
import { defineConfig } from "vite";
import { resolvePlaygroundFont } from "./playground-font";
import { outlineTitles } from "./src/data";

const font = await resolvePlaygroundFont();

export default defineConfig({
  plugins: [
    react(),
    TypeShards({
      font,
      axes: { wght: 900 },
      titles: outlineTitles,
    }),
  ],
});
