import {
  layoutShardedText,
  type LayoutOptions,
} from "./layout";
import type { TextOutline } from "./types";

export type SvgPathData = {
  d: string;
  viewBox: readonly [number, number, number, number];
};

export type OutlineToSvgPathOptions = LayoutOptions;

const PATH_TOKEN = /[A-Za-z]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g;
const PARAMETER_COUNTS = {
  M: 2,
  L: 2,
  Q: 4,
  C: 6,
  Z: 0,
} as const;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function normalizeNumber(value: number): number {
  return Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(6));
}

function transformPath(
  path: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): string {
  const remainder = path
    .replace(PATH_TOKEN, "")
    .replace(/[\s,]/g, "");
  if (remainder) {
    throw new Error(`Invalid Yuragi path data: ${path}`);
  }

  const tokens = path.match(PATH_TOKEN) ?? [];
  let result = "";

  for (let index = 0; index < tokens.length; ) {
    const command = tokens[index++];
    if (!(command && command in PARAMETER_COUNTS)) {
      throw new Error(`Unsupported Yuragi path command: ${command ?? ""}`);
    }

    const count = PARAMETER_COUNTS[
      command as keyof typeof PARAMETER_COUNTS
    ];
    result += command;

    for (let parameter = 0; parameter < count; parameter += 2) {
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Invalid Yuragi path data: ${path}`);
      }
      const transformedX = offsetX + x * scale;
      const transformedY = offsetY + y * scale;
      const separator = parameter === 0 ? "" : " ";
      result += `${separator}${normalizeNumber(transformedX)} ${normalizeNumber(transformedY)}`;
    }
  }

  return result;
}

export function outlineToSvgPath(
  outline: TextOutline,
  options: OutlineToSvgPathOptions,
): SvgPathData {
  const layout = layoutShardedText(outline, options);
  const scale = layout.options.size / outline.em;
  const ascender = outline.ascender * scale;
  const paths: string[] = [];
  const canvasWidth = Number.isFinite(layout.options.maxWidth)
    ? Math.max(layout.dimensions.width, layout.options.maxWidth)
    : layout.dimensions.width;
  const bounds: Bounds = {
    minX: 0,
    minY: 0,
    maxX: canvasWidth,
    maxY: layout.dimensions.height,
  };

  for (const line of layout.lines) {
    const baselineY = ascender + line.y;
    for (const group of line.groups) {
      let glyphX = 0;
      for (const glyph of group.glyphs) {
        const offsetX = line.x + group.x + glyphX;
        const bbox = glyph.bbox;
        bounds.minX = Math.min(bounds.minX, offsetX + bbox.left * scale);
        bounds.minY = Math.min(bounds.minY, baselineY + bbox.top * scale);
        bounds.maxX = Math.max(bounds.maxX, offsetX + bbox.right * scale);
        bounds.maxY = Math.max(bounds.maxY, baselineY + bbox.bottom * scale);
        for (const shard of glyph.shards) {
          paths.push(
            transformPath(shard.path, scale, offsetX, baselineY),
          );
        }
        glyphX += (glyph.advance / outline.em) * layout.options.size;
      }
    }
  }

  const minX = normalizeNumber(bounds.minX);
  const minY = normalizeNumber(bounds.minY);
  const maxX = normalizeNumber(bounds.maxX);
  const maxY = normalizeNumber(bounds.maxY);

  return {
    d: paths.join(""),
    viewBox: [
      minX,
      minY,
      normalizeNumber(maxX - minX),
      normalizeNumber(maxY - minY),
    ],
  };
}
