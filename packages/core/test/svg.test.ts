import { describe, expect, it, vi } from "vitest";
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

const multiGroupOutline: TextOutline = {
  ...outline,
  groups: [
    ...outline.groups,
    {
      text: "B",
      advance: 500,
      breakAfter: true,
      glyphs: [
        {
          char: "B",
          advance: 500,
          bbox: { top: -800, bottom: 200, left: 0, right: 500 },
          shards: [
            { path: "M0 0L500 500L0 500Z", direction: [-1, 0] },
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
    expect(svg.dataset.yuragiRoot).toBe("true");
    expect(svg.classList.contains("yuragi-root")).toBe(true);
    expect(svg.classList.contains("sample")).toBe(true);
    expect(svg.querySelectorAll("[data-line]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-group]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-group-motion]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-glyph]")).toHaveLength(1);
    expect(svg.querySelectorAll("[data-shard-motion]")).toHaveLength(2);
    expect(svg.querySelectorAll("[data-shard]")).toHaveLength(2);
  });

  it("sets size attributes, variables, viewbox, and baseline transform", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout);

    expect(svg.getAttribute("viewBox")).toBe("0 0 10 20");
    expect(svg.getAttribute("width")).toBe("10");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.querySelector("[data-line]")?.getAttribute("transform")).toBe(
      "translate(0 17.6)",
    );
    expect(svg.style.getPropertyValue("--yuragi-size")).toBe("20");
    expect(svg.style.getPropertyValue("--yuragi-em")).toBe("1000");
  });

  it("keeps structural transforms outside animated shard wrappers", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });
    const svg = createShardedSvg(layout, { hover: "outline" });
    const group = svg.querySelector("[data-group]");
    const motion = svg.querySelector("[data-group-motion]");
    const glyph = svg.querySelector("[data-glyph]");
    const shardMotion = svg.querySelector("[data-shard-motion]");
    const scale = svg.querySelector("[data-shard-scale]");
    const shard = svg.querySelector("[data-shard]");

    expect(svg.dataset.hover).toBe("outline");
    expect(group?.getAttribute("transform")).toBe("translate(0 0)");
    expect(motion).not.toBeNull();
    expect(motion?.getAttribute("transform")).toBeNull();
    expect(glyph?.getAttribute("transform")).toBe("translate(0 0)");
    expect(group?.contains(motion)).toBe(true);
    expect(motion?.contains(glyph)).toBe(true);
    expect(glyph?.contains(shardMotion)).toBe(true);
    expect(shardMotion?.getAttribute("transform")).toBeNull();
    expect(scale?.parentElement).toBe(shardMotion);
    expect(scale?.getAttribute("transform")).toBe("scale(0.02)");
    expect(shard?.parentElement).toBe(scale);
    expect(shard?.getAttribute("transform")).toBeNull();
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
    expect(firstMotion.getAttribute("data-shard-x")).toBe("5");
    expect(secondMotion.getAttribute("data-direction-x")).toBe("0");
    expect(secondMotion.getAttribute("data-direction-y")).toBe("1");
    expect(secondMotion.getAttribute("data-shard-x")).toBe("5");
    expect(firstShard.getAttribute("d")).toBe("M0 0L500 0L500 500Z");
    expect(firstShard.getAttribute("data-direction-x")).toBeNull();
    expect(firstShard.getAttribute("data-direction-y")).toBeNull();
    expect(secondShard.getAttribute("d")).toBe("M0 500L500 500L0 0Z");
  });

  it("enables hover motion with outline by default and allows disabling it", () => {
    const layout = layoutShardedText(outline, { size: 20, maxWidth: 40 });

    expect(
      createShardedSvg(layout, { hover: "outline" }).dataset.hoverMotion,
    ).toBe("true");
    expect(
      createShardedSvg(layout, {
        hover: "outline",
        hoverMotion: false,
      }).dataset.hoverMotion,
    ).toBeUndefined();
  });

  it("assigns Layered-style two-dimensional hover offsets per group", () => {
    const random = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1);
    const layout = layoutShardedText(multiGroupOutline, {
      size: 20,
      maxWidth: 40,
    });
    const svg = createShardedSvg(layout, { hover: "outline" });
    const offsets = [
      ...svg.querySelectorAll<SVGGElement>("[data-group-motion]"),
    ].map((motion) => [
      motion.style.getPropertyValue("--yuragi-hover-x"),
      motion.style.getPropertyValue("--yuragi-hover-y"),
    ]);

    expect(offsets).toEqual([
      ["-2.000px", "2.000px"],
      ["2.000px", "-2.000px"],
    ]);
    expect(random).toHaveBeenCalledTimes(8);
    random.mockRestore();
  });
});
