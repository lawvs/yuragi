import type { Align, ShardGroup, TextOutline } from "./types";

export type LayoutOptions = {
  size: number;
  maxWidth?: number;
  lineHeight?: number;
  align?: Align;
};

export type LayoutGroup = ShardGroup & {
  x: number;
  width: number;
  groupIndex: number;
};

export type LayoutLine = {
  index: number;
  x: number;
  y: number;
  width: number;
  groups: LayoutGroup[];
};

export type ShardedTextLayout = {
  outline: TextOutline;
  options: Required<LayoutOptions>;
  lines: LayoutLine[];
  dimensions: {
    width: number;
    height: number;
    lineCount: number;
    unitsPerEm: number;
  };
};

function groupWidth(group: ShardGroup, size: number, em: number): number {
  return (group.advance / em) * size;
}

function alignOffset(align: Align, maxWidth: number, lineWidth: number): number {
  if (lineWidth >= maxWidth) return 0;
  if (align === "center") return (maxWidth - lineWidth) / 2;
  if (align === "end") return maxWidth - lineWidth;
  return 0;
}

function lastBreakIndex(groups: LayoutGroup[]): number {
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    if (groups[index].breakAfter) return index;
  }
  return -1;
}

export function layoutShardedText(
  outline: TextOutline,
  options: LayoutOptions,
): ShardedTextLayout {
  const resolved: Required<LayoutOptions> = {
    size: options.size,
    maxWidth: options.maxWidth ?? Number.POSITIVE_INFINITY,
    lineHeight: options.lineHeight ?? options.size * 1.2,
    align: options.align ?? "start",
  };

  const lines: LayoutLine[] = [];
  let pending: LayoutGroup[] = [];
  let pendingWidth = 0;
  let groupIndex = 0;

  function recalculatePendingPositions() {
    let x = 0;
    pending = pending.map((group) => {
      const next = { ...group, x };
      x += group.width;
      return next;
    });
    pendingWidth = x;
  }

  function flushLine(groupCount = pending.length) {
    if (pending.length === 0) return;
    const groups = pending.slice(0, groupCount);
    const width = groups.reduce((sum, group) => sum + group.width, 0);
    const finiteMax = Number.isFinite(resolved.maxWidth)
      ? resolved.maxWidth
      : width;
    const x = alignOffset(resolved.align, finiteMax, width);
    lines.push({
      index: lines.length,
      x,
      y: lines.length * resolved.lineHeight,
      width,
      groups,
    });
    pending = pending.slice(groupCount);
    recalculatePendingPositions();
  }

  for (const group of outline.groups) {
    const width = groupWidth(group, resolved.size, outline.em);
    if (Number.isFinite(resolved.maxWidth) && width > resolved.maxWidth) {
      throw new Error(
        `Cannot fit group "${group.text}" into maxWidth ${resolved.maxWidth}`,
      );
    }

    if (
      Number.isFinite(resolved.maxWidth) &&
      pending.length > 0 &&
      pendingWidth + width > resolved.maxWidth
    ) {
      const breakIndex = lastBreakIndex(pending);
      if (breakIndex >= 0) {
        flushLine(breakIndex + 1);
      }
    }

    pending.push({
      ...group,
      x: pendingWidth,
      width,
      groupIndex,
    });
    pendingWidth += width;
    groupIndex += 1;
  }

  flushLine();

  const width = lines.reduce(
    (max, line) => Math.max(max, line.x + line.width),
    0,
  );

  return {
    outline,
    options: resolved,
    lines,
    dimensions: {
      width,
      height: lines.length * resolved.lineHeight,
      lineCount: lines.length,
      unitsPerEm: outline.em,
    },
  };
}
