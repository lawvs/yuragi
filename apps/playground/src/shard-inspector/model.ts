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
