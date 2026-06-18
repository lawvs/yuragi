import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  animateShards,
  buildShardKeyframes,
  planShardTimings,
} from "../src/animation";
import { layoutShardedText } from "../src/layout";
import { createShardedSvg } from "../src/svg";
import type { TextOutline } from "../src/types";

describe("buildShardKeyframes", () => {
  it("builds scatter keyframes from shard direction", () => {
    const frames = buildShardKeyframes({
      type: "scatter",
      directionX: 1,
      directionY: 0.5,
      distance: 100,
      scale: 0.95,
    });

    expect(frames[0]).toEqual({});
    expect(frames[1]).toMatchObject({
      opacity: 0,
      transform: "translate(100px, 50px) scale(0.95)",
    });
  });

  it("builds settle keyframes as reverse scatter", () => {
    const frames = buildShardKeyframes({
      type: "settle",
      directionX: 1,
      directionY: 0,
      distance: 100,
      scale: 1.05,
    });

    expect(frames[0]).toMatchObject({
      opacity: 0,
      transform: "translate(100px, 0px) scale(1.05)",
    });
    expect(frames[1]).toEqual({});
  });
});

describe("planShardTimings", () => {
  it("scales transition playback with speed", () => {
    expect(
      planShardTimings({
        type: "scatter",
        speed: 0.5,
        stagger: "by-x",
        shardXs: [0],
      })[0],
    ).toMatchObject({
      duration: 1000,
      delay: 0,
    });
    expect(
      planShardTimings({
        type: "scatter",
        speed: 2,
        stagger: "by-x",
        shardXs: [0],
      })[0],
    ).toMatchObject({
      duration: 250,
      delay: 0,
    });
  });

  it("plans stagger delay from normalized shard x positions", () => {
    const timings = planShardTimings({
      type: "scatter",
      stagger: "by-x",
      shardXs: [100, 0, 50],
    });

    expect(timings.map((timing) => timing.delay)).toEqual([120, 0, 60]);
  });

  it("falls back to index-normalized delay when x positions are missing", () => {
    const timings = planShardTimings({
      type: "scatter",
      stagger: "by-x",
      shardXs: Array.from<number | undefined>({ length: 5 }),
    });

    expect(timings.map((timing) => timing.delay)).toEqual([
      0,
      30,
      60,
      90,
      120,
    ]);
  });

  it("uses the same spatial delay wave for settle and scatter", () => {
    const shardXs = [0, 50, 100];

    expect(
      planShardTimings({
        type: "settle",
        stagger: "by-x",
        shardXs,
      }).map((timing) => timing.delay),
    ).toEqual(
      planShardTimings({
        type: "scatter",
        stagger: "by-x",
        shardXs,
      }).map((timing) => timing.delay),
    );
  });

  it("keeps settle and scatter on the same playback envelope", () => {
    const shardXs = [0, 50, 100];
    const settle = planShardTimings({
      type: "settle",
      speed: 0.8,
      stagger: "by-x",
      shardXs,
    });
    const scatter = planShardTimings({
      type: "scatter",
      speed: 0.8,
      stagger: "by-x",
      shardXs,
    });

    expect(scatter.map(({ delay, duration }) => ({ delay, duration }))).toEqual(
      settle.map(({ delay, duration }) => ({ delay, duration })),
    );
  });
});

describe("animateShards", () => {
  beforeEach(() => {
    Element.prototype.animate = vi.fn(() => ({
      finished: Promise.resolve(),
    })) as unknown as typeof Element.prototype.animate;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it("animates every data-shard-motion wrapper", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const first = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    const second = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    first.dataset.shardMotion = "true";
    first.dataset.directionX = "1";
    first.dataset.directionY = "0";
    second.dataset.shardMotion = "true";
    second.dataset.directionX = "0";
    second.dataset.directionY = "1";
    svg.append(first, second);

    await animateShards(svg, { type: "scatter" });

    expect(Element.prototype.animate).toHaveBeenCalledTimes(2);
  });

  it("passes shard keyframes and animation options to animate", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const motion = document.createElementNS("http://www.w3.org/2000/svg", "g");
    motion.dataset.shardMotion = "true";
    motion.dataset.directionX = "0.5";
    motion.dataset.directionY = "-1";
    svg.append(motion);

    await animateShards(svg, { type: "scatter", distance: 80 });

    expect(Element.prototype.animate).toHaveBeenCalledWith(
      [
        {},
        {
          opacity: 0,
          transform: "translate(40px, -80px) scale(0.95)",
        },
      ],
      {
        duration: 500,
        delay: 0,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );
  });

  it("uses default duration and x-position stagger delay", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const first = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const second = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    first.dataset.shardMotion = "true";
    first.dataset.shardX = "100";
    second.dataset.shardMotion = "true";
    second.dataset.shardX = "0";
    svg.append(first, second);

    await animateShards(svg, { type: "scatter", stagger: "by-x" });

    expect(Element.prototype.animate).toHaveBeenNthCalledWith(
      1,
      expect.any(Array),
      expect.objectContaining({ duration: 500, delay: 120 }),
    );
    expect(Element.prototype.animate).toHaveBeenNthCalledWith(
      2,
      expect.any(Array),
      expect.objectContaining({ duration: 500, delay: 0 }),
    );
  });

  it("uses visual shard x positions before generated fallback positions", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const first = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const second = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    first.dataset.shardMotion = "true";
    first.dataset.shardX = "0";
    first.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 100,
          width: 20,
          height: 20,
        }) as DOMRect,
    );
    second.dataset.shardMotion = "true";
    second.dataset.shardX = "0";
    second.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          width: 20,
          height: 20,
        }) as DOMRect,
    );
    svg.append(first, second);

    await animateShards(svg, { type: "scatter", stagger: "by-x" });

    expect(Element.prototype.animate).toHaveBeenNthCalledWith(
      1,
      expect.any(Array),
      expect.objectContaining({ delay: 120 }),
    );
    expect(Element.prototype.animate).toHaveBeenNthCalledWith(
      2,
      expect.any(Array),
      expect.objectContaining({ delay: 0 }),
    );
  });

  it("does not animate when reduced motion is preferred", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const motion = document.createElementNS("http://www.w3.org/2000/svg", "g");
    motion.dataset.shardMotion = "true";
    svg.append(motion);

    await animateShards(svg, { type: "scatter" });

    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it("resolves when WAAPI is unavailable", async () => {
    Element.prototype.animate =
      undefined as unknown as typeof Element.prototype.animate;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const motion = document.createElementNS("http://www.w3.org/2000/svg", "g");
    motion.dataset.shardMotion = "true";
    svg.append(motion);

    await expect(
      animateShards(svg, { type: "scatter" }),
    ).resolves.toBeUndefined();
  });

  it("falls back to zero for invalid dataset directions", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const motion = document.createElementNS("http://www.w3.org/2000/svg", "g");
    motion.dataset.shardMotion = "true";
    motion.dataset.directionX = "nope";
    motion.dataset.directionY = "Infinity";
    svg.append(motion);

    await animateShards(svg, { type: "scatter", distance: 100 });

    expect(Element.prototype.animate).toHaveBeenCalledWith(
      [
        {},
        {
          opacity: 0,
          transform: "translate(0px, 0px) scale(0.95)",
        },
      ],
      expect.any(Object),
    );
  });

  it("ignores canceled animation promises and synchronous animate failures", async () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const canceled = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    const throwing = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    const finishing = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    canceled.dataset.shardMotion = "true";
    throwing.dataset.shardMotion = "true";
    finishing.dataset.shardMotion = "true";
    svg.append(canceled, throwing, finishing);
    canceled.animate = vi.fn(() => ({
      finished: Promise.reject(
        Object.assign(new Error("canceled"), { name: "AbortError" }),
      ),
    })) as unknown as typeof canceled.animate;
    throwing.animate = vi.fn(() => {
      throw new Error("animate failed");
    }) as unknown as typeof throwing.animate;
    finishing.animate = vi.fn(() => ({
      finished: Promise.resolve(),
    })) as unknown as typeof finishing.animate;

    await expect(
      animateShards(svg, { type: "scatter" }),
    ).resolves.toBeUndefined();
  });

  it("animates generated motion wrappers outside base glyph scale", async () => {
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
              shards: [{ path: "M0 0L500 0L500 500Z", direction: [1, 0] }],
            },
          ],
        },
      ],
    };
    const svg = createShardedSvg(layoutShardedText(outline, { size: 20 }));
    const motionWrapper = svg.querySelector("[data-shard-motion]");
    const scaleWrapper = svg.querySelector("[data-shard-scale]");
    const shard = svg.querySelector("[data-shard]");
    const animate = vi.fn(() => ({
      finished: Promise.resolve(),
    })) as unknown as typeof Element.prototype.animate;
    if (motionWrapper) motionWrapper.animate = animate;

    await animateShards(svg, { type: "scatter" });

    expect(motionWrapper?.contains(scaleWrapper)).toBe(true);
    expect(scaleWrapper?.getAttribute("transform")).toBe("scale(0.02)");
    expect(shard?.getAttribute("transform")).toBeNull();
    expect(animate).toHaveBeenCalledWith(
      [
        {},
        {
          opacity: 0,
          transform: "translate(100px, 0px) scale(0.95)",
        },
      ],
      expect.any(Object),
    );
  });
});
