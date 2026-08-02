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
});
