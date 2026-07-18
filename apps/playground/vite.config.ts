import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolvePlaygroundFont } from "./playground-font";

export default defineConfig(async ({ command }) => {
  const font = command === "serve" ? await resolvePlaygroundFont() : "";
  const coreWasmDir =
    command === "serve"
      ? "../../packages/core/src/wasm"
      : "../../packages/core/dist/wasm";
  const wasmCompilerAsset = new URL(
    command === "serve"
      ? "../../packages/core/wasm/yuragi_wasm_compiler.wasm"
      : "../../packages/core/dist/wasm/yuragi_wasm_compiler.wasm",
    import.meta.url,
  ).pathname;

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
        "@yuragi-labs/core/wasm/runtime": new URL(
          `${coreWasmDir}/runtime.${command === "serve" ? "ts" : "js"}`,
          import.meta.url,
        ).pathname,
        "@yuragi-labs/core/wasm/yuragi_wasm_compiler.wasm?url":
          `${wasmCompilerAsset}?url`,
        "@yuragi-labs/core/wasm/yuragi_wasm_compiler.wasm": wasmCompilerAsset,
        "@yuragi-labs/core/wasm": new URL(
          `${coreWasmDir}/index.${command === "serve" ? "ts" : "js"}`,
          import.meta.url,
        ).pathname,
      },
    },
    plugins: [react()],
  };
});
