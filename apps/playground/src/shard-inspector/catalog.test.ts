import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLYPH_SECTIONS,
  parseGlyphQuery,
} from "./catalog";

describe("Shard Inspector glyph catalog", () => {
  it("includes Latin, numeric, Chinese, hiragana, and katakana sections", () => {
    const sections = Object.fromEntries(
      DEFAULT_GLYPH_SECTIONS.map((section) => [section.id, section.glyphs]),
    );

    expect(sections.latin?.join("")).toBe("abcdefghijklmnopqrstuvwxyz");
    expect(sections.numbers?.join("")).toBe("123456789");
    expect(sections.chinese).toEqual(
      expect.arrayContaining(["一", "人", "中", "国", "永", "字", "层"]),
    );
    expect(sections.hiragana?.join("")).toBe(
      "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
    );
    expect(sections.katakana?.join("")).toBe(
      "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
    );
  });

  it("parses direct glyphs and Unicode code points without duplicates", () => {
    expect(parseGlyphQuery("字a字 U+6C38")).toEqual(["字", "a", "永"]);
    expect(parseGlyphQuery("U+30A2 U+3042")).toEqual(["ア", "あ"]);
  });
});
