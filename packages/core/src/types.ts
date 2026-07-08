export const YURAGI_BUNDLE_VERSION = 1 as const;

export type KnownFontAxisTag =
  | "wght"
  | "wdth"
  | "slnt"
  | "ital"
  | "opsz"
  | "GRAD"
  | "XOPQ"
  | "YOPQ"
  | "XTRA"
  | "YTUC"
  | "YTLC"
  | "YTAS"
  | "YTDE"
  | "YTFI"
  | "CASL"
  | "MONO"
  | "CRSV";

export type FontAxisTag = KnownFontAxisTag | (string & {});

export type FontAxes = Readonly<
  Partial<Record<KnownFontAxisTag, number>> & Record<string, number>
>;

export type TextOutlineBundle = {
  version: typeof YURAGI_BUNDLE_VERSION;
  font: {
    source: string;
    axes?: FontAxes;
    unitsPerEm: number;
    hash: string;
  };
  outlines: OutlineMap;
};

export type OutlineMap = Readonly<Partial<Record<string, TextOutline>>>;

export type TextOutline = {
  em: number;
  ascender: number;
  descender: number;
  groups: ShardGroup[];
};

export type ShardGroup = {
  text: string;
  advance: number;
  breakAfter: boolean;
  glyphs: ShardGlyph[];
};

export type ShardGlyph = {
  char: string;
  advance: number;
  bbox: GlyphBBox;
  shards: Shard[];
};

export type GlyphBBox = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type Shard = {
  path: string;
  direction: readonly [number, number];
};

export type Align = "start" | "center" | "end";

export type ShardTransitionOptions = {
  enter?: "none" | "settle";
  exit?: "none" | "scatter";
  speed?: number;
};
