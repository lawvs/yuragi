import type { TextOutlineBundle } from "@yuragi/core";
import { describe, expect, it } from "vitest";
import { createSectionSnapshot } from "./support/font-regression";

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
