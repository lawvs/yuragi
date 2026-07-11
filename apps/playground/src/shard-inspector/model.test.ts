import { describe, expect, it } from "vitest";
import type { TextOutline } from "@yuragi/core";
import { createGlyphOutlineMap } from "./model";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [
    {
      text: "ab",
      advance: 900,
      breakAfter: true,
      glyphs: [
        {
          char: "a",
          advance: 400,
          bbox: { top: -700, bottom: 0, left: 0, right: 380 },
          shards: [{ path: "M0 0L1 1Z", direction: [1, 0] }],
        },
        {
          char: "b",
          advance: 500,
          bbox: { top: -800, bottom: 0, left: 0, right: 480 },
          shards: [
            { path: "M0 0L2 2Z", direction: [0, 1] },
            { path: "M2 2L3 3Z", direction: [-1, 0] },
          ],
        },
      ],
    },
  ],
};

describe("Shard Inspector outline model", () => {
  it("maps a compiled title into standalone glyph outlines", () => {
    const glyphs = createGlyphOutlineMap(outline);

    expect(glyphs.get("a")?.glyph.shards).toHaveLength(1);
    expect(glyphs.get("b")?.glyph.shards).toHaveLength(2);
    expect(glyphs.get("b")?.outline.groups).toEqual([
      {
        text: "b",
        advance: 500,
        breakAfter: true,
        glyphs: [outline.groups[0]!.glyphs[1]],
      },
    ]);
    expect(glyphs.get("b")?.outline.em).toBe(1000);
  });
});
