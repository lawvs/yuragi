import { describe, expect, it } from "vitest";
import { layoutShardedText } from "../src/layout";
import type { TextOutline } from "../src/types";

function group(text: string, advance: number, breakAfter = true) {
  return {
    text,
    advance,
    breakAfter,
    glyphs: [
      {
        char: text,
        advance,
        bbox: { top: -800, bottom: 200, left: 0, right: advance },
        shards: [{ path: "M0 0L1 0L1 1Z", direction: [1, 0] as const }],
      },
    ],
  };
}

function word(text: string, glyphAdvance: number, breakAfter = true) {
  const glyphs = Array.from(text, (char) => ({
    char,
    advance: glyphAdvance,
    bbox: {
      top: -800,
      bottom: 200,
      left: 0,
      right: glyphAdvance,
    },
    shards: [{ path: "M0 0L1 0L1 1Z", direction: [1, 0] as const }],
  }));
  return {
    text,
    advance: glyphAdvance * glyphs.length,
    breakAfter,
    glyphs,
  };
}

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [group("A", 500), group("B", 500), group("C", 500)],
};

describe("layoutShardedText", () => {
  it("lays out a single line when maxWidth fits all groups", () => {
    const layout = layoutShardedText(outline, {
      size: 20,
      maxWidth: 40,
      lineHeight: 24,
      align: "start",
    });

    expect(layout.lines).toHaveLength(1);
    expect(layout.dimensions.width).toBe(30);
    expect(layout.dimensions.height).toBe(20);
    expect(layout.lines[0].groups.map((group) => group.text)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("wraps at breakAfter boundaries", () => {
    const layout = layoutShardedText(outline, {
      size: 20,
      maxWidth: 20,
      lineHeight: 24,
      align: "start",
    });

    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0].groups.map((group) => group.text)).toEqual([
      "A",
      "B",
    ]);
    expect(layout.lines[1].groups.map((group) => group.text)).toEqual(["C"]);
    expect(layout.dimensions.height).toBe(44);
  });

  it("includes centered line offsets in rendered dimensions", () => {
    const layout = layoutShardedText(outline, {
      size: 20,
      maxWidth: 40,
      lineHeight: 24,
      align: "center",
    });

    expect(layout.lines[0].x).toBe(5);
    expect(layout.dimensions.width).toBe(35);
  });

  it("includes end line offsets in rendered dimensions", () => {
    const layout = layoutShardedText(outline, {
      size: 20,
      maxWidth: 40,
      lineHeight: 24,
      align: "end",
    });

    expect(layout.lines[0].x).toBe(10);
    expect(layout.dimensions.width).toBe(40);
  });

  it("breaks an overwide group at glyph boundaries", () => {
    const longWordOutline: TextOutline = {
      ...outline,
      groups: [word("Dashboard1111111", 500)],
    };

    const layout = layoutShardedText(longWordOutline, {
      size: 20,
      maxWidth: 40,
      lineHeight: 24,
      align: "start",
    });

    expect(
      layout.lines.map((line) =>
        line.groups.map((item) => item.text).join(""),
      ),
    ).toEqual(["Dash", "boar", "d111", "1111"]);
    expect(layout.lines.every((line) => line.width <= 40)).toBe(true);
  });

  it("allows a single overwide glyph on its own line", () => {
    const overwideGlyphOutline: TextOutline = {
      ...outline,
      groups: [group("A", 750), group("B", 250)],
    };

    const layout = layoutShardedText(overwideGlyphOutline, {
      size: 20,
      maxWidth: 10,
      lineHeight: 24,
      align: "start",
    });

    expect(layout.lines.map((line) => line.width)).toEqual([15, 5]);
  });

  it("keeps unbreakable runs together until a valid break point", () => {
    const unbreakableRunOutline: TextOutline = {
      ...outline,
      groups: [group("A", 500, false), group("B", 500), group("C", 500)],
    };

    const layout = layoutShardedText(unbreakableRunOutline, {
      size: 20,
      maxWidth: 15,
      lineHeight: 24,
      align: "start",
    });

    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[0].groups.map((group) => group.text)).toEqual([
      "A",
      "B",
    ]);
    expect(layout.lines[0].width).toBe(20);
    expect(layout.lines[1].groups.map((group) => group.text)).toEqual(["C"]);
  });

  it("does not offset overwide unbreakable lines into negative space", () => {
    const unbreakableRunOutline: TextOutline = {
      ...outline,
      groups: [group("A", 500, false), group("B", 500), group("C", 500)],
    };

    const layout = layoutShardedText(unbreakableRunOutline, {
      size: 20,
      maxWidth: 15,
      lineHeight: 24,
      align: "center",
    });

    expect(layout.lines[0].x).toBe(0);
    expect(layout.lines[0].width).toBe(20);
    expect(layout.dimensions.width).toBe(20);
  });
});
