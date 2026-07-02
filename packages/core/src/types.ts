export const YURAGI_BUNDLE_VERSION = 1 as const;

export type TextOutlineBundle = {
  version: typeof YURAGI_BUNDLE_VERSION;
  font: {
    source: string;
    axes?: Record<string, number>;
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

export type OutlineProvider = {
  preload(texts?: string[]): Promise<void>;
  get(text: string): TextOutline | undefined;
  resolve(text: string): Promise<TextOutline>;
};

export type Align = "start" | "center" | "end";

export type ShardTransitionOptions = {
  enter?: "none" | "settle";
  exit?: "none" | "scatter";
  speed?: number;
};
