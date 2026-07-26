import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  prepareShardAnimation,
  ShardAnimationError,
} from "../src/animation";
import { layoutShardedText } from "../src/layout";
import { createShardedSvg } from "../src/svg";
import type { TextOutline } from "../src/types";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function nativeAnimation() {
  const completion = deferred<void>();
  return {
    animation: {
      currentTime: null,
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(),
      finished: completion.promise,
    } as unknown as Animation,
    completion,
  };
}

function shard(): SVGGElement {
  const element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  element.dataset.shardMotion = "true";
  element.dataset.directionX = "0.5";
  element.dataset.directionY = "-1";
  return element;
}

beforeEach(() => {
  Element.prototype.animate =
    vi.fn() as unknown as typeof Element.prototype.animate;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
});

describe("prepareShardAnimation", () => {
  it("prepares every shard at time zero before playback", async () => {
    const first = nativeAnimation();
    const second = nativeAnimation();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard(), shard());
    vi.mocked(Element.prototype.animate)
      .mockReturnValueOnce(first.animation)
      .mockReturnValueOnce(second.animation);

    const handle = prepareShardAnimation(svg, {
      type: "settle",
      distance: 80,
      stagger: "by-x",
    });

    expect(first.animation.pause).toHaveBeenCalledOnce();
    expect(first.animation.currentTime).toBe(0);
    expect(first.animation.play).not.toHaveBeenCalled();
    expect(second.animation.pause).toHaveBeenCalledOnce();
    expect(second.animation.currentTime).toBe(0);
    expect(second.animation.play).not.toHaveBeenCalled();
    expect(Element.prototype.animate).toHaveBeenCalledWith(
      [
        {
          opacity: 0,
          transform: "translate(40px, -80px) scale(1.05)",
        },
        {},
      ],
      expect.objectContaining({
        duration: 500,
        easing: "cubic-bezier(0, 0, 0, 1)",
        fill: "both",
      }),
    );

    handle.play();
    handle.play();
    expect(first.animation.play).toHaveBeenCalledOnce();
    expect(second.animation.play).toHaveBeenCalledOnce();

    first.completion.resolve();
    await Promise.resolve();
    await expect(
      Promise.race([
        handle.finished,
        Promise.resolve({ status: "still-pending" }),
      ]),
    ).resolves.toEqual({ status: "still-pending" });
    second.completion.resolve();
    await expect(handle.finished).resolves.toEqual({ status: "completed" });
    expect(first.animation.cancel).toHaveBeenCalledOnce();
    expect(second.animation.cancel).toHaveBeenCalledOnce();
  });

  it("retains completed scatter effects until cancellation", async () => {
    const native = nativeAnimation();
    vi.mocked(Element.prototype.animate).mockReturnValue(native.animation);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard());

    const handle = prepareShardAnimation(svg, { type: "scatter" });
    handle.play();
    native.completion.resolve();
    await expect(handle.finished).resolves.toEqual({ status: "completed" });

    expect(native.animation.cancel).not.toHaveBeenCalled();
    handle.cancel();
    handle.cancel();
    expect(native.animation.cancel).toHaveBeenCalledOnce();
  });

  it("cancels before play and settles once", async () => {
    const native = nativeAnimation();
    vi.mocked(Element.prototype.animate).mockReturnValue(native.animation);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard());

    const handle = prepareShardAnimation(svg, { type: "settle" });
    handle.cancel();
    handle.cancel();
    handle.play();

    expect(native.animation.cancel).toHaveBeenCalledOnce();
    expect(native.animation.play).not.toHaveBeenCalled();
    await expect(handle.finished).resolves.toEqual({ status: "cancelled" });
  });

  it("settles cancellation when native cleanup throws", async () => {
    const native = nativeAnimation();
    vi.mocked(native.animation.cancel).mockImplementation(() => {
      throw new Error("cancel failed");
    });
    vi.mocked(Element.prototype.animate).mockReturnValue(native.animation);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard());

    const handle = prepareShardAnimation(svg, { type: "settle" });

    expect(() => handle.cancel()).not.toThrow();
    await expect(handle.finished).resolves.toEqual({ status: "cancelled" });
  });

  it("cancels the previous handle prepared for the same root", async () => {
    const first = nativeAnimation();
    const second = nativeAnimation();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard());
    vi.mocked(Element.prototype.animate)
      .mockReturnValueOnce(first.animation)
      .mockReturnValueOnce(second.animation);

    const previous = prepareShardAnimation(svg, { type: "scatter" });
    const current = prepareShardAnimation(svg, { type: "settle" });

    await expect(previous.finished).resolves.toEqual({
      status: "cancelled",
    });
    expect(first.animation.cancel).toHaveBeenCalledOnce();
    current.cancel();
  });

  it.each([
    [
      "empty",
      () => document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    ],
    [
      "reduced-motion",
      () => {
        vi.mocked(window.matchMedia).mockReturnValue({
          matches: true,
        } as MediaQueryList);
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.append(shard());
        return svg;
      },
    ],
    [
      "unsupported",
      () => {
        Element.prototype.animate =
          undefined as unknown as typeof Element.prototype.animate;
        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg",
        );
        svg.append(shard());
        return svg;
      },
    ],
  ] as const)("reports skipped/%s", async (reason, createRoot) => {
    const handle = prepareShardAnimation(createRoot(), { type: "settle" });
    await expect(handle.finished).resolves.toEqual({
      status: "skipped",
      reason,
    });
  });

  it.each([
    [{ type: "settle", speed: 0 }, "speed"],
    [{ type: "settle", speed: Number.NaN }, "speed"],
    [{ type: "settle", distance: -1 }, "distance"],
  ] as const)("rejects invalid options before mutation", (options, field) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard());
    expect(() => prepareShardAnimation(svg, options)).toThrow(field);
    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it("rolls back every shard after a preparation failure", async () => {
    const first = nativeAnimation();
    const cause = new Error("animate failed");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard(), shard());
    vi.mocked(Element.prototype.animate)
      .mockReturnValueOnce(first.animation)
      .mockImplementationOnce(() => {
        throw cause;
      });

    const handle = prepareShardAnimation(svg, { type: "scatter" });

    expect(first.animation.cancel).toHaveBeenCalledOnce();
    const result = await handle.finished;
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBeInstanceOf(ShardAnimationError);
      expect(result.error.phase).toBe("prepare");
      expect(result.error.cause).toBe(cause);
    }
  });

  it("rolls back an animation when pausing it fails", async () => {
    const native = nativeAnimation();
    const cause = new Error("pause failed");
    const abort = Object.assign(new Error("cancelled"), {
      name: "AbortError",
    });
    vi.mocked(native.animation.pause).mockImplementationOnce(() => {
      throw cause;
    });
    vi.mocked(native.animation.cancel).mockImplementationOnce(() => {
      native.completion.reject(abort);
    });
    vi.mocked(Element.prototype.animate).mockReturnValue(native.animation);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard());

    const handle = prepareShardAnimation(svg, { type: "scatter" });

    expect(native.animation.cancel).toHaveBeenCalledOnce();
    const result = await handle.finished;
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.phase).toBe("prepare");
      expect(result.error.cause).toBe(cause);
    }
    await Promise.resolve();
  });

  it("fails atomically when native playback rejects", async () => {
    const first = nativeAnimation();
    const second = nativeAnimation();
    const cause = new Error("play failed");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard(), shard());
    vi.mocked(Element.prototype.animate)
      .mockReturnValueOnce(first.animation)
      .mockReturnValueOnce(second.animation);

    const handle = prepareShardAnimation(svg, { type: "scatter" });
    handle.play();
    first.completion.reject(cause);

    const result = await handle.finished;
    expect(result.status).toBe("failed");
    expect(second.animation.cancel).toHaveBeenCalledOnce();
    if (result.status === "failed") {
      expect(result.error.phase).toBe("play");
      expect(result.error.cause).toBe(cause);
    }
  });

  it("uses visual shard x positions before generated fallback positions", () => {
    const first = nativeAnimation();
    const second = nativeAnimation();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const firstShard = shard();
    const secondShard = shard();
    firstShard.dataset.shardX = "0";
    firstShard.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 100,
          width: 20,
          height: 20,
        }) as DOMRect,
    );
    secondShard.dataset.shardX = "0";
    secondShard.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 0,
          width: 20,
          height: 20,
        }) as DOMRect,
    );
    svg.append(firstShard, secondShard);
    vi.mocked(Element.prototype.animate)
      .mockReturnValueOnce(first.animation)
      .mockReturnValueOnce(second.animation);

    const handle = prepareShardAnimation(svg, {
      type: "scatter",
      stagger: "by-x",
    });

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
    handle.cancel();
  });

  it("scales transition playback and spatial delay with speed", () => {
    const first = nativeAnimation();
    const second = nativeAnimation();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const firstShard = shard();
    const secondShard = shard();
    firstShard.dataset.shardX = "0";
    secondShard.dataset.shardX = "100";
    svg.append(firstShard, secondShard);
    vi.mocked(Element.prototype.animate)
      .mockReturnValueOnce(first.animation)
      .mockReturnValueOnce(second.animation);

    const handle = prepareShardAnimation(svg, {
      type: "scatter",
      speed: 2,
      stagger: "by-x",
    });

    expect(Element.prototype.animate).toHaveBeenNthCalledWith(
      2,
      expect.any(Array),
      expect.objectContaining({ duration: 250, delay: 60 }),
    );
    handle.cancel();
  });

  it("falls back to index-normalized delay when x positions are missing", () => {
    const animations = Array.from({ length: 5 }, nativeAnimation);
    vi.mocked(Element.prototype.animate).mockImplementation(
      () => animations.shift()!.animation,
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(shard(), shard(), shard(), shard(), shard());

    const handle = prepareShardAnimation(svg, {
      type: "scatter",
      stagger: "by-x",
    });

    expect(
      vi
        .mocked(Element.prototype.animate)
        .mock.calls.map(([, timing]) => (timing as KeyframeAnimationOptions).delay),
    ).toEqual([0, 30, 60, 90, 120]);
    handle.cancel();
  });

  it("animates generated motion wrappers outside base glyph scale", () => {
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
    const renderedShard = svg.querySelector("[data-shard]");
    const native = nativeAnimation();
    const animate = vi.fn(() => native.animation);
    if (motionWrapper) motionWrapper.animate = animate;

    const handle = prepareShardAnimation(svg, { type: "scatter" });

    expect(motionWrapper?.contains(scaleWrapper)).toBe(true);
    expect(scaleWrapper?.getAttribute("transform")).toBe("scale(0.02)");
    expect(renderedShard?.getAttribute("transform")).toBeNull();
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
    handle.cancel();
  });
});
