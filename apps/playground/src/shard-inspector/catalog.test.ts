import { describe, expect, it } from "vitest";
import { parseGlyphQuery } from "./catalog";

describe("Shard Inspector glyph catalog", () => {
  it("parses direct glyphs and Unicode code points without duplicates", () => {
    expect(parseGlyphQuery("字a字 U+6C38")).toEqual(["字", "a", "永"]);
    expect(parseGlyphQuery("U+30A2 U+3042")).toEqual(["ア", "あ"]);
  });
});
