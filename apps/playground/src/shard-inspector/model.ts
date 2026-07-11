import type { ShardGlyph, TextOutline } from "@yuragi/core";

export type InspectorGlyph = {
  glyph: ShardGlyph;
  outline: TextOutline;
};

export function createGlyphOutlineMap(
  outline: TextOutline,
): Map<string, InspectorGlyph> {
  const glyphs = new Map<string, InspectorGlyph>();

  for (const group of outline.groups) {
    for (const glyph of group.glyphs) {
      if (glyphs.has(glyph.char)) continue;

      glyphs.set(glyph.char, {
        glyph,
        outline: {
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
        },
      });
    }
  }

  return glyphs;
}
