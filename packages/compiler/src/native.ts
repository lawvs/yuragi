import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FontAxes, TextOutlineBundle } from "@yuragi/core";

type NativeCompilerOptions = {
  font: string;
  axes?: FontAxes;
  titles: string[];
};

function packageRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const leaf = basename(moduleDir);

  if (leaf === "src" || leaf === "dist") {
    return resolve(moduleDir, "..");
  }

  return moduleDir;
}

function cargoTargetDir(manifestPath: string): string {
  const hash = createHash("sha256").update(manifestPath).digest("hex").slice(0, 12);
  return resolve(tmpdir(), `yuragi-cargo-target-${hash}`);
}

function runCargo(args: string[], manifestPath: string): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    const child = spawn("cargo", args, {
      cwd: packageRoot(),
      env: {
        ...process.env,
        CARGO_TARGET_DIR: cargoTargetDir(manifestPath),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveOutput(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `Native compiler exited with code ${code}`));
    });
  });
}

export async function runNativeCompiler(
  options: NativeCompilerOptions,
): Promise<TextOutlineBundle> {
  const tempDir = await mkdtemp(resolve(tmpdir(), "yuragi-"));
  const titlesPath = resolve(tempDir, "titles.json");
  const manifestPath = resolve(packageRoot(), "native", "Cargo.toml");

  try {
    await writeFile(titlesPath, JSON.stringify(options.titles), "utf8");

    const args = [
      "run",
      "--quiet",
      "--manifest-path",
      manifestPath,
      "--",
      "--font",
      options.font,
      "--titles",
      titlesPath,
    ];

    if (options.axes) {
      args.push("--axes", JSON.stringify(options.axes));
    }

    const stdout = await runCargo(args, manifestPath);
    return JSON.parse(stdout) as TextOutlineBundle;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}
