import { fileURLToPath } from "node:url";
import type { TextOutlineBundle } from "@yuragi/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_GLYPHS,
  DEFAULT_GLYPH_SECTIONS,
} from "../../../apps/playground/src/shard-inspector/catalog";
import { resolveFont } from "../../../scripts/font-cache";
import {
  SOURCE_HAN_SERIF_AXES,
  SOURCE_HAN_SERIF_SHA256,
} from "../../../shared/source-han-serif";
import { compileOutlines } from "../src/index";
import { createSectionSnapshot } from "./support/font-regression";

describe("Source Han Serif common glyph outlines", () => {
  let bundle: TextOutlineBundle;

  beforeAll(async () => {
    expect(new Set(DEFAULT_GLYPHS).size).toBe(DEFAULT_GLYPHS.length);

    const font = await resolveFont({});
    bundle = await compileOutlines({
      font,
      axes: SOURCE_HAN_SERIF_AXES,
      titles: DEFAULT_GLYPHS,
    });

    expect(bundle.font.hash).toBe(SOURCE_HAN_SERIF_SHA256);
  }, 180_000);

  it.each(DEFAULT_GLYPH_SECTIONS)(
    "matches the $label file snapshot",
    async (section) => {
      const snapshot = createSectionSnapshot(
        section,
        bundle,
        SOURCE_HAN_SERIF_AXES,
      );
      const json = `${JSON.stringify(snapshot, null, 2)}\n`;
      const snapshotPath = fileURLToPath(
        new URL(
          `./fixtures/source-han-serif/snapshots/${section.id}.json`,
          import.meta.url,
        ),
      );

      await expect(json).toMatchFileSnapshot(snapshotPath);
    },
  );
});
