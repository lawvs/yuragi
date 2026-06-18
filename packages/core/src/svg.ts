import type { ShardedTextLayout } from "./layout";

const SVG_NS = "http://www.w3.org/2000/svg";

export type SvgOptions = {
  className?: string;
  hover?: "none" | "outline";
};

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

export function createShardedSvg(
  layout: ShardedTextLayout,
  options: SvgOptions = {},
): SVGSVGElement {
  const scale = layout.options.size / layout.outline.em;
  const ascender = layout.outline.ascender * scale;
  const descender = Math.abs(layout.outline.descender * scale);
  const height =
    ascender +
    descender +
    Math.max(0, layout.dimensions.lineCount - 1) * layout.options.lineHeight;
  const svg = svgEl("svg");
  svg.dataset.typeShardsRoot = "true";
  svg.classList.add("ts-root");
  const classNames = options.className?.trim().split(/\s+/).filter(Boolean);
  if (classNames?.length) svg.classList.add(...classNames);
  if (options.hover === "outline") svg.dataset.hover = "outline";

  svg.setAttribute(
    "viewBox",
    `0 0 ${layout.dimensions.width} ${height}`,
  );
  svg.setAttribute("width", String(layout.dimensions.width));
  svg.setAttribute("height", String(height));
  svg.style.setProperty("--ts-size", String(layout.options.size));
  svg.style.setProperty("--ts-em", String(layout.dimensions.unitsPerEm));
  svg.style.setProperty("--ts-line-height", `${layout.options.lineHeight}px`);

  for (const line of layout.lines) {
    const baselineY = ascender + line.y;
    const lineEl = svgEl("g");
    lineEl.dataset.line = String(line.index);
    lineEl.style.setProperty("--ts-line-x", `${line.x}px`);
    lineEl.style.setProperty("--ts-line-y", `${baselineY}px`);
    lineEl.setAttribute("transform", `translate(${line.x} ${baselineY})`);
    svg.append(lineEl);

    for (const group of line.groups) {
      const groupEl = svgEl("g");
      groupEl.dataset.group = group.text;
      groupEl.dataset.groupIndex = String(group.groupIndex);
      groupEl.style.setProperty("--ts-group-x", `${group.x}px`);
      groupEl.setAttribute("transform", `translate(${group.x} 0)`);
      lineEl.append(groupEl);

      const motionEl = svgEl("g");
      motionEl.dataset.groupMotion = "true";
      groupEl.append(motionEl);

      let glyphX = 0;
      for (const glyph of group.glyphs) {
        const glyphEl = svgEl("g");
        glyphEl.dataset.glyph = glyph.char;
        glyphEl.style.setProperty("--ts-glyph-x", `${glyphX}px`);
        glyphEl.setAttribute("transform", `translate(${glyphX} 0)`);
        motionEl.append(glyphEl);

        for (const shard of glyph.shards) {
          const shardMotionEl = svgEl("g");
          shardMotionEl.dataset.shardMotion = "true";
          shardMotionEl.dataset.directionX = String(shard.direction[0]);
          shardMotionEl.dataset.directionY = String(shard.direction[1]);
          shardMotionEl.dataset.shardX = String(
            line.x +
              group.x +
              glyphX +
              ((glyph.advance / layout.outline.em) * layout.options.size) / 2,
          );

          const scaleEl = svgEl("g");
          scaleEl.dataset.shardScale = "true";
          scaleEl.setAttribute("transform", `scale(${scale})`);

          const path = svgEl("path");
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
