import { constants } from "node:fs";
import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeDir = resolve(packageDir, "wasm-compiler");
const manifestPath = resolve(nativeDir, "Cargo.toml");
const targetDir = resolve(nativeDir, "target");
const wasmSource = resolve(
  targetDir,
  "wasm32-unknown-unknown/release/yuragi_wasm_compiler.wasm",
);
const wasmDir = resolve(packageDir, "wasm");
const wasmDestination = resolve(wasmDir, "yuragi_wasm_compiler.wasm");

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: nativeDir,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function targetInstalled() {
  return new Promise((resolveInstalled, reject) => {
    const child = spawn("rustup", ["target", "list", "--installed"], {
      cwd: nativeDir,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let stdout = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`rustup exited with code ${code}`));
        return;
      }

      resolveInstalled(stdout.split(/\s+/).includes("wasm32-unknown-unknown"));
    });
  });
}

async function main() {
  if (!(await targetInstalled())) {
    await run("rustup", ["target", "add", "wasm32-unknown-unknown"]);
  }

  await run(
    "cargo",
    [
      "build",
      "--release",
      "--locked",
      "--target",
      "wasm32-unknown-unknown",
      "--manifest-path",
      manifestPath,
      "--target-dir",
      targetDir,
    ],
  );

  await access(wasmSource, constants.R_OK);
  await mkdir(wasmDir, { recursive: true });
  await copyFile(wasmSource, wasmDestination);

  const { size } = await stat(wasmDestination);
  console.log(`[yuragi wasm] wrote ${wasmDestination} (${size} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
