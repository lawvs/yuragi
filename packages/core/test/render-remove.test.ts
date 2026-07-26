import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  renderYuragiText,
  YuragiTextError,
  type TextOutline,
} from "../src/index";
import {
  ShardAnimationError,
  type ShardAnimationHandle,
  type ShardAnimationOptions,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

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

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
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

function createTarget(): HTMLDivElement {
  const target = document.createElement("div");
  document.body.append(target);
  return target;
}

beforeEach(() => {
  animationMocks.prepare.mockReset();
  animationMocks.prepare.mockImplementation(
    (_root: SVGSVGElement, _options: ShardAnimationOptions) =>
      animationHandle(),
  );
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("YuragiTextHandle removal", () => {
  it("removes the owned SVG, animates a fixed clone, and allows a replacement", async () => {
    const scatter = deferred<ShardAnimationResult>();
    animationMocks.prepare.mockImplementation((_root, options) =>
      options.type === "scatter"
        ? animationHandle(scatter.promise)
        : animationHandle(),
    );
    const target = createTarget();
    const first = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });
    first.element.style.color = "rgb(1, 2, 3)";
    first.element.getBoundingClientRect = vi.fn(() =>
      rect(12, 18, 90, 40),
    );

    const removal = first.remove();
    const overlay = document.querySelector<SVGSVGElement>(
      "[data-yuragi-exit]",
    );
    expect(target.children).toHaveLength(0);
    expect(overlay?.parentElement).toBe(document.body);
    expect(overlay?.style.position).toBe("fixed");
    expect(overlay?.style.left).toBe("12px");
    expect(overlay?.style.top).toBe("18px");
    expect(overlay?.style.width).toBe("90px");
    expect(overlay?.style.height).toBe("40px");
    expect(overlay?.style.color).toBe("rgb(1, 2, 3)");

    const second = renderYuragiText(target, outline, {
      size: 64,
      animation: false,
    });
    expect(target.firstElementChild).toBe(second.element);

    scatter.resolve({ status: "completed" });
    await expect(removal).resolves.toEqual({ status: "completed" });
    expect(overlay?.isConnected).toBe(false);
    expect(target.firstElementChild).toBe(second.element);
  });

  it("inherits enter options, applies removal overrides, and reuses its promise", () => {
    const target = createTarget();
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: {
        autoplay: false,
        speed: 0.8,
        distance: 80,
        stagger: "none",
      },
    });

    const first = handle.remove({ distance: 120 });
    const second = handle.remove({ speed: 2 });

    expect(second).toBe(first);
    expect(animationMocks.prepare).toHaveBeenLastCalledWith(
      expect.any(SVGSVGElement),
      {
        type: "scatter",
        speed: 0.8,
        distance: 120,
        stagger: "none",
      },
    );
  });

  it("rejects invalid removal options before changing the title", () => {
    const target = createTarget();
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    expect(() => handle.remove({ speed: 0 })).toThrow("speed");
    expect(() => handle.remove({ distance: -1 })).toThrow("distance");
    expect(target.firstElementChild).toBe(handle.element);
    expect(document.querySelector("[data-yuragi-exit]")).toBeNull();
  });

  it("cancel resolves enter even when the internal handle never settles", async () => {
    const enter = animationHandle(new Promise(() => undefined));
    animationMocks.prepare.mockReturnValue(enter);
    const target = createTarget();
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: { autoplay: false },
    });

    const playback = handle.play();
    handle.cancel();

    expect(enter.cancel).toHaveBeenCalledOnce();
    expect(target.firstElementChild).toBe(handle.element);
    await expect(playback).resolves.toEqual({
      status: "cancelled",
    });
  });

  it("cancel removes an active exit overlay and resolves removal as cancelled", async () => {
    const scatter = animationHandle(new Promise(() => undefined));
    animationMocks.prepare.mockReturnValue(scatter);
    const target = createTarget();
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    const removal = handle.remove();
    handle.cancel();

    expect(scatter.cancel).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-yuragi-exit]")).toBeNull();
    await expect(removal).resolves.toEqual({ status: "cancelled" });
  });

  it("dispose cancels active removal and is idempotent", async () => {
    const scatter = animationHandle(new Promise(() => undefined));
    animationMocks.prepare.mockReturnValue(scatter);
    const target = createTarget();
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    const removal = handle.remove();
    handle.dispose();
    handle.dispose();

    expect(scatter.cancel).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-yuragi-exit]")).toBeNull();
    await expect(removal).resolves.toEqual({ status: "cancelled" });
    await expect(handle.remove()).resolves.toEqual({
      status: "cancelled",
    });
  });

  it("a replaced handle cannot start an exit over newer content", async () => {
    const target = createTarget();
    const first = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });
    const second = renderYuragiText(target, outline, {
      size: 64,
      animation: false,
    });

    await expect(first.remove()).resolves.toEqual({
      status: "cancelled",
    });
    expect(document.querySelector("[data-yuragi-exit]")).toBeNull();
    expect(target.firstElementChild).toBe(second.element);
  });

  it("removes without animation when the owner document has no body", async () => {
    const xmlDocument = document.implementation.createDocument(
      null,
      "target",
    );
    const target = xmlDocument.documentElement;
    const handle = renderYuragiText(target, outline, {
      size: 48,
      animation: false,
    });

    await expect(handle.remove()).resolves.toEqual({
      status: "skipped",
      reason: "unsupported",
    });
    expect(target.children).toHaveLength(0);
  });

  it("maps an exit failure and cleans the overlay", async () => {
    const cause = new Error("scatter failed");
    animationMocks.prepare.mockReturnValue(
      animationHandle({
        status: "failed",
        error: new ShardAnimationError("play", cause),
      }),
    );
    const handle = renderYuragiText(createTarget(), outline, {
      size: 48,
      animation: false,
    });

    const result = await handle.remove();

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error).toBeInstanceOf(YuragiTextError);
      expect(result.error.phase).toBe("exit");
      expect(result.error.cause).toBe(cause);
    }
    expect(document.querySelector("[data-yuragi-exit]")).toBeNull();
  });
});
