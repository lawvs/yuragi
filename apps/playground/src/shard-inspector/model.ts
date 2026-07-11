import type { Shard, TextOutline } from "@yuragi/core";

export type InspectorGlyph = {
  char: string;
  advance: number;
  shards: Shard[];
  outline: TextOutline;
};

export function createInspectorGlyph(
  char: string,
  outline: TextOutline,
): InspectorGlyph | undefined {
  const glyphs = outline.groups.flatMap((group) => group.glyphs);
  if (glyphs.length === 0) return undefined;

  return {
    char,
    advance: outline.groups.reduce((sum, group) => sum + group.advance, 0),
    shards: glyphs.flatMap((glyph) => glyph.shards),
    outline,
  };
}

export function createGlyphOutlineMap(
  outline: TextOutline,
): Map<string, InspectorGlyph> {
  const glyphs = new Map<string, InspectorGlyph>();

  for (const group of outline.groups) {
    for (const glyph of group.glyphs) {
      if (glyphs.has(glyph.char)) continue;

      const glyphOutline: TextOutline = {
        em: outline.em,
        ascender: outline.ascender,
        descender: outline.descender,
        groups: [
          {
            text: glyph.char,
            advance: glyph.advance,
            breakAfter: true,
            glyphs: [glyph],
          },
        ],
      };
      const inspectorGlyph = createInspectorGlyph(glyph.char, glyphOutline);
      if (inspectorGlyph) glyphs.set(glyph.char, inspectorGlyph);
    }
  }

  return glyphs;
}
