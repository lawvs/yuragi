import { constants } from "node:fs";
import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const playgroundDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(playgroundDir, "../..");
const experimentDir = resolve(repoRoot, "experiments/wasm-compiler");
const manifestPath = resolve(experimentDir, "Cargo.toml");
const targetDir = resolve(experimentDir, "target");
const wasmSource = resolve(
  targetDir,
  "wasm32-unknown-unknown/release/type_shards_wasm_compiler.wasm",
);
const publicDir = resolve(playgroundDir, "public/type-shards-wasm");
const wasmDestination = resolve(publicDir, "type_shards_wasm_compiler.wasm");

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: "inherit",
      ...options,
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
  try {
    await run("rustup", ["target", "list", "--installed"], {
      cwd: experimentDir,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch {
    return false;
  }

  return new Promise((resolveInstalled, reject) => {
    const child = spawn("rustup", ["target", "list", "--installed"], {
      cwd: experimentDir,
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
    await run("rustup", ["target", "add", "wasm32-unknown-unknown"], {
      cwd: experimentDir,
    });
  }

  await run("cargo", [
    "build",
    "--release",
    "--offline",
    "--target",
    "wasm32-unknown-unknown",
    "--manifest-path",
    manifestPath,
    "--target-dir",
    targetDir,
  ], { cwd: experimentDir });

  await access(wasmSource, constants.R_OK);
  await mkdir(publicDir, { recursive: true });
  await copyFile(wasmSource, wasmDestination);

  const { size } = await stat(wasmDestination);
  console.log(
    `[type-shards wasm lab] wrote ${wasmDestination} (${size} bytes)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
