import { describe, expect, it } from "vitest";
import { layoutShardedText } from "../src/layout";
import { createShardedSvg } from "../src/svg";
import type { TextOutline } from "../src/types";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [
    {
      text: "A",
      advance: 500,
      breakAfter: true,
      glyphs: [
        {
          char: "A",
          advance: 500,
          bbox: { top: -800, bottom: 200, left: 0, right: 500 },
          shards: [
            { path: "M0 0L500 0L500 500Z", direction: [1, 0] },
            { path: "M0 500L500 500L0 0Z", direction: [0, 1] },
          ],
        },
      ],
    },
  ],
};

describe("createShardedSvg", () => {
  it("materializes a stable SVG structure", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout, { className: "sample" });

    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.dataset.typeShardsRoot).toBe("true");
    expect(svg.classList.contains("ts-root")).toBe(true);
    expect(svg.classList.contains("sample")).toBe(true);
    expect(svg.querySelectorAll("[data-line]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-group]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-group-motion]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-glyph]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-shard-motion]")).toHaveLength(2);
    expect(svg.querySelectorAll("[data-shard]")).toHaveLength(2);
  });

  it("sets size variables, viewbox, and baseline transform", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout);

    expect(svg.getAttribute("viewBox")).toBe("0 0 10 20");
    expect(svg.querySelector("[data-line]")?.getAttribute("transform")).toBe(
      "translate(0 17.6)",
    );
    expect(svg.style.getPropertyValue("--ts-size")).toBe("20");
    expect(svg.style.getPropertyValue("--ts-em")).toBe("1000");
  });

  it("uses layout line y for baseline positioning", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg({
      ...layout,
      lines: layout.lines.map((line) => ({ ...line, y: 7 })),
    });

    expect(svg.querySelector("[data-line]")?.getAttribute("transform")).toBe(
      "translate(0 24.6)",
    );
  });

  it("keeps structural group transforms separate from motion transforms", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout, { hover: "outline" });
    const group = svg.querySelector("[data-group]");
    const motion = svg.querySelector("[data-group-motion]");
    const glyph = svg.querySelector("[data-glyph]");

    expect(svg.dataset.hover).toBe("outline");
    expect(group?.getAttribute("transform")).toBe("translate(0 0)");
    expect(motion).not.toBeNull();
    expect(motion?.getAttribute("transform")).toBeNull();
    expect(glyph?.getAttribute("transform")).toBe("translate(0 0)");
    expect(group?.contains(motion)).toBe(true);
    expect(motion?.contains(glyph)).toBe(true);
  });

  it("sets shard path attributes and shard motion directions", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout);
    const [firstMotion, secondMotion] = svg.querySelectorAll(
      "[data-shard-motion]",
    );
    const [firstShard, secondShard] = svg.querySelectorAll("[data-shard]");

    expect(firstMotion.getAttribute("data-direction-x")).toBe("1");
    expect(firstMotion.getAttribute("data-direction-y")).toBe("0");
    expect(secondMotion.getAttribute("data-direction-x")).toBe("0");
    expect(secondMotion.getAttribute("data-direction-y")).toBe("1");
    expect(firstShard.getAttribute("d")).toBe("M0 0L500 0L500 500Z");
    expect(firstShard.getAttribute("data-direction-x")).toBeNull();
    expect(firstShard.getAttribute("data-direction-y")).toBeNull();
    expect(secondShard.getAttribute("d")).toBe("M0 500L500 500L0 0Z");
  });

  it("nests shard motion outside static scale and path", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout);
    const glyph = svg.querySelector("[data-glyph]");
    const motionWrappers = svg.querySelectorAll("[data-shard-motion]");
    const scaleWrappers = svg.querySelectorAll("[data-shard-scale]");
    const [firstShard] = svg.querySelectorAll("[data-shard]");

    expect(motionWrappers).toHaveLength(2);
    expect(scaleWrappers).toHaveLength(2);
    expect(glyph?.contains(motionWrappers[0])).toBe(true);
    expect(motionWrappers[0].parentElement).toBe(glyph);
    expect(motionWrappers[0].getAttribute("transform")).toBeNull();
    expect(scaleWrappers[0].getAttribute("transform")).toBe("scale(0.02)");
    expect(scaleWrappers[0].parentElement).toBe(motionWrappers[0]);
    expect(scaleWrappers[0].contains(firstShard)).toBe(true);
    expect(firstShard.parentElement).toBe(scaleWrappers[0]);
    expect(firstShard.getAttribute("transform")).toBeNull();
  });

  it("normalizes className whitespace", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout, {
      className: "  sample\nsecond  ",
    });

    expect(svg.classList.contains("sample")).toBe(true);
    expect(svg.classList.contains("second")).toBe(true);
  });
});
