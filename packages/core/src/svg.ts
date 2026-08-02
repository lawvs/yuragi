import type { ShardedTextLayout } from "./layout";

const SVG_NS = "http://www.w3.org/2000/svg";

export type SvgOptions = {
  className?: string;
  hover?: "none" | "outline";
  hoverMotion?: boolean;
};

function svgEl<K extends keyof SVGElementTagNameMap>(
  ownerDocument: Document,
  tag: K,
): SVGElementTagNameMap[K] {
  return ownerDocument.createElementNS(SVG_NS, tag);
}

function randomWithin(start: number, end: number): number {
  const theta = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random());
  const x = Math.cos(theta) * radius;
  return (start + end) / 2 + (x * (start - end)) / 2;
}

function groupHoverOffsets(): { x: string; y: string } {
  const offset = () => `${(randomWithin(-1, 1) * 2).toFixed(3)}px`;
  return {
    x: offset(),
    y: offset(),
  };
}

export function createShardedSvg(
  layout: ShardedTextLayout,
  options: SvgOptions = {},
  ownerDocument: Document = document,
): SVGSVGElement {
  const scale = layout.options.size / layout.outline.em;
  const ascender = layout.outline.ascender * scale;
  const svg = svgEl(ownerDocument, "svg");
  svg.dataset.yuragiRoot = "true";
  svg.classList.add("yuragi-root");
  const classNames = options.className?.trim().split(/\s+/).filter(Boolean);
  if (classNames?.length) svg.classList.add(...classNames);
  if (options.hover === "outline") svg.dataset.hover = "outline";
  if (options.hoverMotion ?? options.hover === "outline") {
    svg.dataset.hoverMotion = "true";
  }

  svg.setAttribute(
    "viewBox",
    `0 0 ${layout.dimensions.width} ${layout.dimensions.height}`,
  );
  svg.setAttribute("width", String(layout.dimensions.width));
  svg.setAttribute("height", String(layout.dimensions.height));
  svg.style.setProperty("--yuragi-size", String(layout.options.size));
  svg.style.setProperty("--yuragi-em", String(layout.dimensions.unitsPerEm));
  svg.style.setProperty("--yuragi-line-height", `${layout.options.lineHeight}px`);

  for (const line of layout.lines) {
    const baselineY = ascender + line.y;
    const lineEl = svgEl(ownerDocument, "g");
    lineEl.dataset.line = String(line.index);
    lineEl.style.setProperty("--yuragi-line-x", `${line.x}px`);
    lineEl.style.setProperty("--yuragi-line-y", `${baselineY}px`);
    lineEl.setAttribute("transform", `translate(${line.x} ${baselineY})`);
    svg.append(lineEl);

    for (const group of line.groups) {
      const groupEl = svgEl(ownerDocument, "g");
      groupEl.dataset.group = group.text;
      groupEl.dataset.groupIndex = String(group.groupIndex);
      groupEl.style.setProperty("--yuragi-group-x", `${group.x}px`);
      groupEl.setAttribute("transform", `translate(${group.x} 0)`);
      lineEl.append(groupEl);

      const motionEl = svgEl(ownerDocument, "g");
      motionEl.dataset.groupMotion = "true";
      const hoverOffsets = groupHoverOffsets();
      motionEl.style.setProperty("--yuragi-hover-x", hoverOffsets.x);
      motionEl.style.setProperty("--yuragi-hover-y", hoverOffsets.y);
      groupEl.append(motionEl);

      let glyphX = 0;
      for (const glyph of group.glyphs) {
        const glyphEl = svgEl(ownerDocument, "g");
        glyphEl.dataset.glyph = glyph.char;
        glyphEl.style.setProperty("--yuragi-glyph-x", `${glyphX}px`);
        glyphEl.setAttribute("transform", `translate(${glyphX} 0)`);
        motionEl.append(glyphEl);

        for (const shard of glyph.shards) {
          const shardMotionEl = svgEl(ownerDocument, "g");
          shardMotionEl.dataset.shardMotion = "true";
          shardMotionEl.dataset.directionX = String(shard.direction[0]);
          shardMotionEl.dataset.directionY = String(shard.direction[1]);
          shardMotionEl.dataset.shardX = String(
            line.x +
              group.x +
              glyphX +
              ((glyph.advance / layout.outline.em) * layout.options.size) / 2,
          );

          const scaleEl = svgEl(ownerDocument, "g");
          scaleEl.dataset.shardScale = "true";
          scaleEl.setAttribute("transform", `scale(${scale})`);

          const path = svgEl(ownerDocument, "path");
          path.dataset.shard = "true";
          path.setAttribute("d", shard.path);
          scaleEl.append(path);
          shardMotionEl.append(scaleEl);
          glyphEl.append(shardMotionEl);
        }

        glyphX += (glyph.advance / layout.outline.em) * layout.options.size;
      }
    }
  }

  return svg;
}
