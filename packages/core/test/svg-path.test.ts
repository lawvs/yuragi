import { describe, expect, it } from "vitest";
import {
  outlineToSvgPath,
  type TextOutline,
} from "../src/index";

const outline: TextOutline = {
  em: 1000,
  ascender: 800,
  descender: -200,
  groups: [
    {
      text: "A",
      advance: 500,
      breakAfter: true,
      glyphs: [
        {
          char: "A",
          advance: 500,
          bbox: { top: -800, bottom: 0, left: 0, right: 500 },
          shards: [
            {
              path: "M 0 0L 500 0L 500 -800Z",
              direction: [1, 0],
            },
          ],
        },
      ],
    },
    {
      text: "B",
      advance: 500,
      breakAfter: true,
      glyphs: [
        {
          char: "B",
          advance: 500,
          bbox: { top: -800, bottom: 0, left: 0, right: 500 },
          shards: [
            {
              path: "M 0 0Q 250 -800 500 0Z",
              direction: [-1, 0],
            },
          ],
        },
      ],
    },
  ],
};

describe("outlineToSvgPath", () => {
  it("flattens glyph positions and font scaling into one path", () => {
    const result = outlineToSvgPath(outline, { size: 20 });

    expect(result).toEqual({
      d: "M0 16L10 16L10 0ZM10 16Q15 0 20 16Z",
      viewBox: [0, 0, 20, 20],
    });
  });

  it("transforms cubic Bézier control points", () => {
    const cubicOutline: TextOutline = {
      ...outline,
      groups: [
        {
          ...outline.groups[0]!,
          glyphs: [
            {
              ...outline.groups[0]!.glyphs[0]!,
              shards: [
                {
                  path: "M 0 0C 100 0 400 -800 500 -800Z",
                  direction: [1, 0],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(outlineToSvgPath(cubicOutline, { size: 20 }).d).toBe(
      "M0 16C2 16 8 0 10 0Z",
    );
  });

  it("flattens wrapped and aligned line positions", () => {
    const result = outlineToSvgPath(outline, {
      size: 20,
      maxWidth: 15,
      lineHeight: 24,
      align: "end",
    });

    expect(result).toEqual({
      d: "M5 16L15 16L15 0ZM5 40Q10 24 15 40Z",
      viewBox: [0, 0, 15, 44],
    });
  });

  it("preserves a finite alignment canvas", () => {
    const singleGlyphOutline: TextOutline = {
      ...outline,
      groups: [outline.groups[0]!],
    };

    expect(
      outlineToSvgPath(singleGlyphOutline, {
        size: 20,
        maxWidth: 20,
        align: "center",
      }),
    ).toEqual({
      d: "M5 16L15 16L15 0Z",
      viewBox: [0, 0, 20, 20],
    });
  });

  it("includes glyph overhangs in the view box", () => {
    const overhangingOutline: TextOutline = {
      ...outline,
      groups: [
        {
          ...outline.groups[0]!,
          glyphs: [
            {
              ...outline.groups[0]!.glyphs[0]!,
              bbox: {
                top: -900,
                bottom: 100,
                left: -100,
                right: 600,
              },
              shards: [
                {
                  path: "M -100 100L 600 100L 600 -900Z",
                  direction: [1, 0],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(outlineToSvgPath(overhangingOutline, { size: 20 })).toEqual({
      d: "M-2 18L12 18L12 -2Z",
      viewBox: [-2, -2, 14, 22],
    });
  });

  it("rejects malformed path data instead of skipping it", () => {
    const malformedOutline: TextOutline = {
      ...outline,
      groups: [
        {
          ...outline.groups[0]!,
          glyphs: [
            {
              ...outline.groups[0]!.glyphs[0]!,
              shards: [
                {
                  path: "M0 0L500 0@L500 -800Z",
                  direction: [1, 0],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(() =>
      outlineToSvgPath(malformedOutline, { size: 20 }),
    ).toThrow("Invalid Yuragi path data");
  });
});
