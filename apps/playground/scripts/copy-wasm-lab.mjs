import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const playgroundDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSource = resolve(
  playgroundDir,
  "../../packages/wasm/wasm/yuragi_wasm_compiler.wasm",
);
const wasmDestination = resolve(
  playgroundDir,
  "public/yuragi-wasm/yuragi_wasm_compiler.wasm",
);

await mkdir(dirname(wasmDestination), { recursive: true });
await copyFile(wasmSource, wasmDestination);

const { size } = await stat(wasmDestination);
console.log(`[yuragi wasm lab] wrote ${wasmDestination} (${size} bytes)`);
