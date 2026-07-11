import { describe, expect, it } from "vitest";
import type { TextOutline } from "@yuragi/core";
import { createGlyphOutlineMap, createInspectorGlyph } from "./model";

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

    expect(glyphs.get("a")?.shards).toHaveLength(1);
    expect(glyphs.get("b")?.shards).toHaveLength(2);
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

  it("keeps a multi-code-point grapheme as one inspector entry", () => {
    const glyph = createInspectorGlyph("e\u0301", outline);

    expect(glyph?.char).toBe("e\u0301");
    expect(glyph?.shards).toHaveLength(3);
    expect(glyph?.advance).toBe(900);
    expect(glyph?.outline).toBe(outline);
  });
});
