import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveFont } from "../../../scripts/font-cache";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "yuragi-font-cache-test-"));
  tempDirs.push(dir);
  return dir;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("resolveFont", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
    );
  });

  it("reuses a cached remote font after verifying its checksum", async () => {
    const cacheDir = await makeTempDir();
    const destination = join(cacheDir, "font.otf");
    await writeFile(destination, "cached-font");
    const download = vi.fn();

    const font = await resolveFont(
      { YURAGI_FONT: "https://example.test/font.otf" },
      {
        cacheDir,
        download,
        expectedSha256: sha256("cached-font"),
      },
    );

    expect(font).toBe(destination);
    expect(download).not.toHaveBeenCalled();
  });

  it("replaces a cached remote font when its checksum is invalid", async () => {
    const cacheDir = await makeTempDir();
    const destination = join(cacheDir, "font.otf");
    await writeFile(destination, "corrupt-font");

    const font = await resolveFont(
      { YURAGI_FONT: "https://example.test/font.otf" },
      {
        cacheDir,
        expectedSha256: sha256("fresh-font"),
        download: async ({ destination: temporary }) => {
          await writeFile(temporary, "fresh-font");
        },
      },
    );

    expect(font).toBe(destination);
    expect(await readFile(destination, "utf8")).toBe("fresh-font");
  });

  it("rejects a downloaded font with the wrong checksum and removes temporary files", async () => {
    const cacheDir = await makeTempDir();

    await expect(
      resolveFont(
        { YURAGI_FONT: "https://example.test/font.otf" },
        {
          cacheDir,
          expectedSha256: sha256("expected-font"),
          download: async ({ destination }) => {
            await writeFile(destination, "wrong-font");
          },
        },
      ),
    ).rejects.toThrow("downloaded font checksum mismatch");

    expect(await readdir(cacheDir)).toEqual([]);
  });
});
