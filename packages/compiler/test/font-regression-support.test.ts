import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TextOutlineBundle } from "@yuragi-labs/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSectionFileSnapshot,
  compareSectionSnapshots,
  createSectionSnapshot,
  type GlyphSectionSnapshot,
} from "./support/font-regression";

const outline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

const bundle: TextOutlineBundle = {
  version: 1,
  font: {
    source: "/tmp/font.otf",
    axes: { wght: 900 },
    unitsPerEm: 1000,
    hash: "font-sha",
  },
  outlines: {
    a: outline,
    "𠮷": outline,
  },
};

describe("createSectionSnapshot", () => {
  it("preserves catalog order and normalizes font metadata and code points", () => {
    const snapshot = createSectionSnapshot(
      {
        id: "test",
        label: "Test Glyphs",
        glyphs: ["𠮷", "a"],
      },
      bundle,
      { wght: 900 },
    );

    expect(snapshot).toEqual({
      schemaVersion: 1,
      font: {
        sha256: "font-sha",
        axes: { wght: 900 },
        unitsPerEm: 1000,
      },
      section: {
        id: "test",
        label: "Test Glyphs",
      },
      glyphs: [
        { char: "𠮷", codePoints: ["U+20BB7"], outline },
        { char: "a", codePoints: ["U+0061"], outline },
      ],
    });
  });

  it("rejects a catalog glyph that is missing from compiler output", () => {
    expect(() =>
      createSectionSnapshot(
        { id: "test", label: "Test Glyphs", glyphs: ["missing"] },
        bundle,
        { wght: 900 },
      ),
    ).toThrow('Missing compiled outline for "missing"');
  });
});

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "yuragi-regression-test-"));
  tempDirs.push(dir);
  return dir;
}

function detailedSnapshot(): GlyphSectionSnapshot {
  return {
    schemaVersion: 1,
    font: {
      sha256: "font-sha",
      axes: { wght: 900 },
      unitsPerEm: 1000,
    },
    section: { id: "latin", label: "Latin" },
    glyphs: [
      {
        char: "a",
        codePoints: ["U+0061"],
        outline: {
          em: 1000,
          ascender: 800,
          descender: -200,
          groups: [
            {
              text: "a",
              advance: 500,
              breakAfter: false,
              glyphs: [
                {
                  char: "a",
                  advance: 500,
                  bbox: { top: -700, bottom: 0, left: 10, right: 490 },
                  shards: [
                    {
                      path: "M 10 0L 490 0L 250 -700Z",
                      direction: [1, 0],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

describe("font regression diagnostics", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
    );
  });

  it("classifies the fields changed for a glyph", () => {
    const expected = detailedSnapshot();
    const actual = structuredClone(expected);
    const glyph = actual.glyphs[0]!.outline.groups[0]!.glyphs[0]!;
    actual.glyphs[0]!.outline.groups[0]!.advance = 510;
    glyph.advance = 510;
    glyph.bbox.right = 500;
    glyph.shards[0]!.path = "M 10 0L 500 0L 250 -700Z";
    glyph.shards[0]!.direction = [0, 1];
    glyph.shards.push({ path: "M 0 0Z", direction: [-1, 0] });

    expect(compareSectionSnapshots(expected, actual)).toEqual([
      {
        char: "a",
        codePoints: ["U+0061"],
        fields: ["advance", "bbox", "shard-count", "path", "direction"],
      },
    ]);
  });

  it("writes visual diagnostics without hiding the snapshot mismatch", async () => {
    const outputDir = await makeTempDir();
    const snapshotPath = join(outputDir, "latin.json");
    const expected = detailedSnapshot();
    const actual = structuredClone(expected);
    actual.glyphs[0]!.outline.groups[0]!.glyphs[0]!.shards[0]!.path =
      "M 10 0L 500 0L 250 -700Z";
    await writeFile(snapshotPath, `${JSON.stringify(expected, null, 2)}\n`);
    const mismatch = new Error("snapshot mismatch");

    await expect(
      assertSectionFileSnapshot({
        actual,
        snapshotPath,
        outputDir,
        match: async () => {
          throw mismatch;
        },
      }),
    ).rejects.toBe(mismatch);

    const sectionDir = join(outputDir, "latin");
    expect(await readFile(join(sectionDir, "summary.txt"), "utf8")).toContain(
      "a (U+0061): path",
    );
    expect(await readFile(join(sectionDir, "expected.svg"), "utf8")).toContain(
      'data-guide="baseline"',
    );
    expect(await readFile(join(sectionDir, "diff.svg"), "utf8")).toContain(
      "#ef4444",
    );
    expect(
      await readFile(join(sectionDir, "glyphs/u0061.diff.svg"), "utf8"),
    ).toContain("#06b6d4");
  });
});
