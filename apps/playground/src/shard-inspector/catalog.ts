export type GlyphSection = {
  id: "latin" | "numbers" | "chinese" | "hiragana" | "katakana";
  label: string;
  glyphs: string[];
};

const LATIN = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "123456789";
const COMMON_CHINESE = "一二三十人大小中日月山水火木上下左右天地口田国永文字分层";
const HIRAGANA =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
const KATAKANA =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

export const DEFAULT_GLYPH_SECTIONS: GlyphSection[] = [
  { id: "latin", label: "Latin", glyphs: Array.from(LATIN) },
  { id: "numbers", label: "Numbers", glyphs: Array.from(NUMBERS) },
  {
    id: "chinese",
    label: "Common Chinese",
    glyphs: Array.from(COMMON_CHINESE),
  },
  { id: "hiragana", label: "Hiragana", glyphs: Array.from(HIRAGANA) },
  { id: "katakana", label: "Katakana", glyphs: Array.from(KATAKANA) },
];

export const DEFAULT_GLYPHS = DEFAULT_GLYPH_SECTIONS.flatMap(
  (section) => section.glyphs,
);

export function mergeUniqueGlyphs(
  current: readonly string[],
  additions: readonly string[],
): string[] {
  return Array.from(new Set([...current, ...additions]));
}

function splitGraphemes(value: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }

  return Array.from(value);
}

export function parseGlyphQuery(value: string): string[] {
  const unicodeGlyphs: string[] = [];
  const remaining = value.replace(/U\+([0-9a-f]{4,6})/gi, (_, hex: string) => {
    const codePoint = Number.parseInt(hex, 16);
    if (codePoint <= 0x10ffff) {
      unicodeGlyphs.push(String.fromCodePoint(codePoint));
    }
    return " ";
  });
  const directGlyphs = splitGraphemes(remaining).filter(
    (glyph) => !/^\s+$/u.test(glyph),
  );

  return mergeUniqueGlyphs(directGlyphs, unicodeGlyphs);
}
