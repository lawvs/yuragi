// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SOURCE_HAN_SERIF_URL } from "../../../shared/source-han-serif";
import {
  resolveHeroFont,
  resolvePlaygroundFont,
} from "../playground-font";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "yuragi-font-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolvePlaygroundFont", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })));
  });

  it("uses the Source Han Serif remote font by default", async () => {
    const cacheDir = await makeTempDir();
    let downloadedUrl = "";
    const font = await resolvePlaygroundFont(
      {},
      {
        cacheDir,
        expectedSha256: false,
        download: async ({ destination, url }) => {
          downloadedUrl = url;
          await writeFile(destination, "font");
        },
      },
    );

    expect(font).toBe(join(cacheDir, "SourceHanSerifSC-VF.otf"));
    expect(await readFile(font, "utf8")).toBe("font");
    expect(downloadedUrl).toBe(SOURCE_HAN_SERIF_URL);
  });

  it("pins hero generation to Source Han Serif and verifies its checksum", async () => {
    const cacheDir = await makeTempDir();
    const previousFont = process.env.YURAGI_FONT;
    let downloadedUrl = "";
    process.env.YURAGI_FONT = "https://example.test/custom.otf";

    try {
      await expect(
        resolveHeroFont({
          cacheDir,
          download: async ({ destination, url }) => {
            downloadedUrl = url;
            await writeFile(destination, "not-source-han-serif");
          },
        }),
      ).rejects.toThrow("downloaded font checksum mismatch");
    } finally {
      if (previousFont === undefined) {
        delete process.env.YURAGI_FONT;
      } else {
        process.env.YURAGI_FONT = previousFont;
      }
    }

    expect(downloadedUrl).toBe(SOURCE_HAN_SERIF_URL);
  });

  it("resolves relative YURAGI_FONT paths from a local base directory", async () => {
    const baseDir = await makeTempDir();
    await mkdir(join(baseDir, "fonts"));
    await writeFile(join(baseDir, "fonts", "local.otf"), "relative-local-font");

    const font = await resolvePlaygroundFont(
      {
        YURAGI_FONT: "fonts/local.otf",
      },
      { localBaseDir: baseDir },
    );

    expect(font).toBe(resolve(baseDir, "fonts/local.otf"));
  });

  it("allows YURAGI_FONT to load from a URL into the Vite cache", async () => {
    const cacheDir = await makeTempDir();
    const font = await resolvePlaygroundFont(
      {
        YURAGI_FONT: "https://example.test/title.otf",
      },
      {
        cacheDir,
        download: async ({ destination, url }) => {
          await writeFile(destination, `downloaded from ${url}`);
        },
      },
    );

    expect(font).toBe(join(cacheDir, "title.otf"));
    expect(await readFile(font, "utf8")).toBe(
      "downloaded from https://example.test/title.otf",
    );
  });
});
