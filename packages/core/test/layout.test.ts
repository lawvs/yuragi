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

  it("rejects any breakable group wider than maxWidth", () => {
    expect(() =>
      layoutShardedText(outline, {
        size: 20,
        maxWidth: 4,
        lineHeight: 24,
        align: "start",
      }),
    ).toThrow("Cannot fit group");

    const wideLaterOutline: TextOutline = {
      ...outline,
      groups: [group("A", 250), group("B", 750), group("C", 250)],
    };

    expect(() =>
      layoutShardedText(wideLaterOutline, {
        size: 20,
        maxWidth: 10,
        lineHeight: 24,
        align: "start",
      }),
    ).toThrow('Cannot fit group "B"');
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
