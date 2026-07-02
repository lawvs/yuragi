import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFile = promisify(execFileCallback);

describe("package packlist", () => {
  it("excludes Cargo target build artifacts", async () => {
    const packDir = await mkdtemp(resolve(tmpdir(), "yuragi-pack-test-"));

    try {
      await execFile("pnpm", ["pack", "--json", "--pack-destination", packDir], {
        cwd: packageDir,
      });

      const tarballs = (await readdir(packDir)).filter((file) => file.endsWith(".tgz"));
      expect(tarballs).toHaveLength(1);

      const tarballPath = resolve(packDir, tarballs[0]);
      const { stdout } = await execFile("tar", ["-tzf", tarballPath]);
      const entries = stdout.split("\n").filter(Boolean);

      expect(entries.some((entry) => entry.startsWith("package/native/target/"))).toBe(
        false,
      );
    } finally {
      await rm(packDir, { force: true, recursive: true });
    }
  });
});
