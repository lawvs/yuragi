import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderYuragiText,
  YuragiTextError,
  type TextOutline,
} from "../src/index";
import {
  ShardAnimationError,
  type ShardAnimationHandle,
  type ShardAnimationResult,
} from "../src/animation";

const animationMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
}));

vi.mock("../src/animation", async () => {
  const actual = await vi.importActual<typeof import("../src/animation")>(
    "../src/animation",
  );
  return { ...actual, prepareShardAnimation: animationMocks.prepare };
});

function animationHandle(
  result:
    | ShardAnimationResult
    | Promise<ShardAnimationResult> = { status: "completed" },
): ShardAnimationHandle {
  return {
    play: vi.fn(),
    cancel: vi.fn(),
    finished: Promise.resolve(result),
  };
}

const outline: TextOutline = {
  em: 1000,
  ascender: 800,
  descender: -200,
  groups: [
    {
      text: "A",
      advance: 500,
      breakAfter: true,
      glyphs: [
        {
          char: "A",
          advance: 500,
          bbox: { top: -800, bottom: 0, left: 0, right: 500 },
          shards: [
            {
              path: "M0 0L500 0L500 500Z",
              direction: [1, 0],
            },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  animationMocks.prepare.mockReset();
  animationMocks.prepare.mockImplementation(() => animationHandle());
});

describe("renderYuragiText", () => {
  it("prepares off-DOM, mounts atomically, and autoplays defaults", () => {
    const target = document.createElement("div");
    target.textContent = "fallback";
    let connectedDuringPrepare = true;
    const prepared = animationHandle();
    animationMocks.prepare.mockImplementation((root: SVGSVGElement) => {
      connectedDuringPrepare = root.isConnected;
      expect(target.textContent).toBe("fallback");
      return prepared;
    });

    const handle = renderYuragiText(target, outline, { size: 72 });

    expect(connectedDuringPrepare).toBe(false);
    expect(target.firstElementChild).toBe(handle.element);
    expect(prepared.play).toHaveBeenCalledOnce();
    expect(animationMocks.prepare).toHaveBeenCalledWith(handle.element, {
      type: "settle",
      speed: 1,
      distance: 100,
      stagger: "by-x",
    });
  });

  it("mounts the prepared frame and waits when autoplay is false", async () => {
    const prepared = animationHandle();
    animationMocks.prepare.mockReturnValue(prepared);
    const target = document.createElement("div");
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: { autoplay: false },
    });

    expect(target.firstElementChild).toBe(handle.element);
    expect(prepared.play).not.toHaveBeenCalled();
    const firstPlayback = handle.play();
    expect(prepared.play).toHaveBeenCalledOnce();
    const secondPlayback = handle.play();
    expect(secondPlayback).toBe(firstPlayback);
    await expect(firstPlayback).resolves.toEqual({ status: "completed" });
  });

  it("renders statically without preparing animation", async () => {
    const target = document.createElement("div");
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    expect(animationMocks.prepare).not.toHaveBeenCalled();
    expect(handle).not.toHaveProperty("finished");
    await expect(handle.play()).resolves.toEqual({
      status: "skipped",
      reason: "disabled",
    });
  });

  it("passes layout and SVG options through the public seam", () => {
    const target = document.createElement("div");
    const handle = renderYuragiText(target, outline, {
      size: 40,
      maxWidth: 80,
      lineHeight: 60,
      align: "end",
      className: "title featured",
      hover: "outline",
      animation: false,
    });

    expect(handle.element.classList.contains("title")).toBe(true);
    expect(handle.element.classList.contains("featured")).toBe(true);
    expect(handle.element.dataset.hover).toBe("outline");
    expect(handle.element.style.getPropertyValue("--yuragi-line-height")).toBe(
      "60px",
    );
  });

  it("derives, overrides, and hides the accessible label", () => {
    const target = document.createElement("div");
    expect(
      renderYuragiText(target, outline, {
        size: 48,
        animation: false,
      }).element.getAttribute("aria-label"),
    ).toBe("A");
    expect(
      renderYuragiText(target, outline, {
        size: 48,
        ariaLabel: "Title",
        animation: false,
      }).element.getAttribute("aria-label"),
    ).toBe("Title");

    const hidden = renderYuragiText(target, outline, {
      size: 48,
      ariaLabel: false,
      animation: false,
    }).element;
    expect(hidden.getAttribute("aria-hidden")).toBe("true");
    expect(hidden.hasAttribute("aria-label")).toBe(false);
  });

  it("creates SVG nodes in the target ownerDocument", () => {
    const otherDocument =
      document.implementation.createHTMLDocument("other");
    const target = otherDocument.createElement("div");
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    expect(handle.element.ownerDocument).toBe(otherDocument);
    expect(handle.element.querySelector("path")?.ownerDocument).toBe(
      otherDocument,
    );
  });

  it.each([
    [{ size: 0 }, "size"],
    [{ size: Number.NaN }, "size"],
    [{ size: 48, maxWidth: Number.POSITIVE_INFINITY }, "maxWidth"],
    [{ size: 48, lineHeight: -1 }, "lineHeight"],
  ] as const)(
    "rejects invalid options before target mutation",
    (options, field) => {
      const target = document.createElement("div");
      target.textContent = "unchanged";

      expect(() => renderYuragiText(target, outline, options)).toThrow(field);
      expect(target.textContent).toBe("unchanged");
      expect(animationMocks.prepare).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid outline advances before target mutation", () => {
    const target = document.createElement("div");
    target.textContent = "unchanged";
    const invalidOutline: TextOutline = {
      ...outline,
      groups: [{ ...outline.groups[0]!, advance: Number.NaN }],
    };

    expect(() =>
      renderYuragiText(target, invalidOutline, { size: 48 }),
    ).toThrow("groups[0].advance");
    expect(target.textContent).toBe("unchanged");
    expect(animationMocks.prepare).not.toHaveBeenCalled();
  });

  it("leaves the current owner unchanged when a replacement is invalid", () => {
    const target = document.createElement("div");
    const current = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    expect(() =>
      renderYuragiText(target, outline, { size: 0 }),
    ).toThrow("size");
    expect(target.firstElementChild).toBe(current.element);
  });

  it("cancels the previous same-target owner without letting it affect the replacement", () => {
    const firstAnimation = animationHandle();
    const secondAnimation = animationHandle();
    animationMocks.prepare
      .mockReturnValueOnce(firstAnimation)
      .mockReturnValueOnce(secondAnimation);
    const target = document.createElement("div");
    const first = renderYuragiText(target, outline, { size: 48 });
    const second = renderYuragiText(target, outline, { size: 64 });

    expect(firstAnimation.cancel).toHaveBeenCalledOnce();
    first.cancel();
    first.dispose();
    expect(target.firstElementChild).toBe(second.element);
  });

  it("maps internal failures to an enter YuragiTextError", async () => {
    const cause = new Error("native playback failed");
    animationMocks.prepare.mockReturnValue(
      animationHandle({
        status: "failed",
        error: new ShardAnimationError("play", cause),
      }),
    );
    const handle = renderYuragiText(
      document.createElement("div"),
      outline,
      { size: 48 },
    );

    const result = await handle.play();
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBeInstanceOf(YuragiTextError);
      expect(result.error.phase).toBe("enter");
      expect(result.error.cause).toBe(cause);
    }
  });

  it("turns an unexpected preparation throw into a readable failure", async () => {
    const cause = new Error("prepare crashed");
    animationMocks.prepare.mockImplementation(() => {
      throw cause;
    });
    const target = document.createElement("div");

    const handle = renderYuragiText(target, outline, { size: 48 });

    expect(target.firstElementChild).toBe(handle.element);
    const result = await handle.play();
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.phase).toBe("enter");
      expect(result.error.cause).toBe(cause);
    }
  });
});
