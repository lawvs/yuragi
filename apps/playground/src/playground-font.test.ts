// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SOURCE_HAN_SERIF_URL } from "../../../shared/source-han-serif";
import { resolvePlaygroundFont } from "../playground-font";

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

  it("allows YURAGI_FONT to load from a local file without caching", async () => {
    const dir = await makeTempDir();
    const localFont = join(dir, "local.otf");
    await writeFile(localFont, "local-font");

    const font = await resolvePlaygroundFont({
      YURAGI_FONT: localFont,
    });

    expect(font).toBe(localFont);
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
