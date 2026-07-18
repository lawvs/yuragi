import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const smokeScriptPath = resolve(repoRoot, "scripts/release-smoke.mjs");
const packageDirectories = ["core", "compiler", "react"];

interface PackageManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface PackedPackage {
  manifest: PackageManifest;
  tarball: string;
}

interface RunOptions {
  cwd?: string;
}

function run(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<void> {
  console.log(
    `> ${command} ${args.map((argument) => JSON.stringify(argument)).join(" ")}`,
  );

  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}`,
        ),
      );
    });
  });
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function tarballName(manifest: PackageManifest): string {
  const slug = manifest.name.replace(/^@/, "").replace("/", "-");
  return `${slug}-${manifest.version}.tgz`;
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "yuragi-release-"));

try {
  const packDirectory = resolve(temporaryRoot, "packs");
  const consumerDirectory = resolve(temporaryRoot, "consumer");
  await mkdir(packDirectory, { recursive: true });
  await mkdir(consumerDirectory, { recursive: true });

  const packages: PackedPackage[] = [];
  for (const directory of packageDirectories) {
    const packageRoot = resolve(repoRoot, "packages", directory);
    const manifest = await readJson<PackageManifest>(
      resolve(packageRoot, "package.json"),
    );
    await run("pnpm", ["pack", "--pack-destination", packDirectory], {
      cwd: packageRoot,
    });

    const tarball = resolve(packDirectory, tarballName(manifest));
    await access(tarball);
    packages.push({ manifest, tarball });
  }

  const reactPackage = packages.find(
    ({ manifest }) => manifest.name === "@yuragi-labs/react",
  );
  if (!reactPackage) {
    throw new Error("@yuragi-labs/react is missing from the release package set");
  }

  const dependencies = Object.fromEntries(
    packages.map(({ manifest, tarball }) => [
      manifest.name,
      pathToFileURL(tarball).href,
    ]),
  );
  dependencies.react = reactPackage.manifest.devDependencies.react;
  dependencies["react-dom"] =
    reactPackage.manifest.devDependencies["react-dom"];

  await writeFile(
    resolve(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "yuragi-release-smoke",
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    )}\n`,
  );
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
    ],
    { cwd: consumerDirectory },
  );

  const releasedVersions = new Map(
    packages.map(({ manifest }) => [manifest.name, manifest.version]),
  );
  for (const { manifest } of packages) {
    const [scope, name] = manifest.name.split("/");
    const installed = await readJson<PackageManifest>(
      resolve(consumerDirectory, "node_modules", scope, name, "package.json"),
    );
    if (installed.version !== manifest.version) {
      throw new Error(
        `${manifest.name} installed as ${installed.version}, expected ${manifest.version}`,
      );
    }

    for (const [dependency, version] of Object.entries(
      installed.dependencies ?? {},
    )) {
      if (version.startsWith("workspace:")) {
        throw new Error(
          `${manifest.name} retained workspace dependency ${dependency}`,
        );
      }
      const releasedVersion = releasedVersions.get(dependency);
      if (releasedVersion && version !== releasedVersion) {
        throw new Error(
          `${manifest.name} depends on ${dependency}@${version}, expected ${releasedVersion}`,
        );
      }
    }
  }

  await copyFile(smokeScriptPath, resolve(consumerDirectory, "smoke.mjs"));

  await run(process.execPath, ["smoke.mjs"], { cwd: consumerDirectory });
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
