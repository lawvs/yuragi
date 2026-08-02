import { StrictMode } from "react";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  YuragiTextError,
  type TextOutline,
  type YuragiTextHandle,
  type YuragiTextResult,
} from "@yuragi-labs/core";
import { YuragiText } from "../src/YuragiText";

const coreMocks = vi.hoisted(() => ({
  renderYuragiText: vi.fn(),
}));

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return {
    ...actual,
    renderYuragiText: coreMocks.renderYuragiText,
  };
});

type HandleConfig = {
  playback?: YuragiTextResult | Promise<YuragiTextResult>;
  removal?: YuragiTextResult | Promise<YuragiTextResult>;
  onPlay?: (element: SVGSVGElement) => void;
};

type TestHandle = YuragiTextHandle & {
  play: Mock;
  cancel: Mock;
  remove: Mock;
  dispose: Mock;
};

let handleConfigs: HandleConfig[] = [];
let issuedHandles: TestHandle[] = [];

function rendererHandle(
  target: Element,
  config: HandleConfig = {},
): TestHandle {
  const element = target.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  element.dataset.yuragiRoot = "true";
  const playback = Promise.resolve(
    config.playback ??
      ({ status: "completed" } satisfies YuragiTextResult),
  );
  let removalPromise: Promise<YuragiTextResult> | null = null;
  let resolveRemoval:
    | ((result: YuragiTextResult) => void)
    | null = null;
  let removalSettled = false;

  const settleRemoval = (result: YuragiTextResult) => {
    if (removalSettled) return;
    removalSettled = true;
    resolveRemoval?.(result);
  };
  const handle: TestHandle = {
    element,
    play: vi.fn(() => {
      config.onPlay?.(element);
      return playback;
    }),
    cancel: vi.fn(),
    remove: vi.fn(() => {
      if (!removalPromise) {
        removalPromise = new Promise<YuragiTextResult>((resolve) => {
          resolveRemoval = resolve;
        });
        element.remove();
        void Promise.resolve(
          config.removal ??
            ({ status: "completed" } satisfies YuragiTextResult),
        ).then(settleRemoval);
      }
      return removalPromise;
    }),
    dispose: vi.fn(() => {
      element.remove();
      settleRemoval({ status: "cancelled" });
    }),
  };
  target.replaceChildren(element);
  return handle;
}

function queueHandle(config: HandleConfig): void {
  handleConfigs.push(config);
}

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

const nextOutline: TextOutline = {
  ...outline,
  groups: [
    {
      ...outline.groups[0]!,
      text: "B",
      glyphs: [
        {
          ...outline.groups[0]!.glyphs[0]!,
          char: "B",
        },
      ],
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  handleConfigs = [];
  issuedHandles = [];
  coreMocks.renderYuragiText.mockReset();
  coreMocks.renderYuragiText.mockImplementation((target: Element) => {
    const handle = rendererHandle(target, handleConfigs.shift());
    issuedHandles.push(handle);
    return handle;
  });
});

afterEach(async () => {
  cleanup();
  await Promise.resolve();
  document.body.replaceChildren();
});

describe("YuragiText", () => {
  it("renders through the public core renderer and starts after mounting", () => {
    render(
      <YuragiText
        text="A"
        outline={outline}
        size={24}
        maxWidth={240}
        align="center"
        className="title"
        hover="outline"
      />,
    );

    const handle = issuedHandles[0]!;
    expect(coreMocks.renderYuragiText).toHaveBeenCalledWith(
      expect.any(HTMLSpanElement),
      outline,
      {
        size: 24,
        maxWidth: 240,
        align: "center",
        className: "title",
        hover: "outline",
        ariaLabel: false,
        animation: {
          autoplay: false,
          speed: undefined,
        },
      },
    );
    expect(document.querySelector("[data-yuragi-root]")).toBe(
      handle.element,
    );
    expect(handle.play).toHaveBeenCalledOnce();
  });

  it("applies SVG styles before enter playback", () => {
    let colorDuringPlay = "";
    queueHandle({
      onPlay: (element) => {
        colorDuringPlay = element.style.color;
      },
    });

    render(
      <YuragiText
        text="A"
        outline={outline}
        style={{ color: "red" }}
      />,
    );

    expect(colorDuringPlay).toBe("red");
  });

  it("uses a static render when enter animation is disabled", () => {
    render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ enter: false }}
      />,
    );

    expect(coreMocks.renderYuragiText).toHaveBeenCalledWith(
      expect.any(HTMLSpanElement),
      outline,
      expect.objectContaining({ animation: false }),
    );
    expect(issuedHandles[0]?.play).toHaveBeenCalledOnce();
  });

  it("removes the previous handle before rendering changed content", async () => {
    const exit = deferred<YuragiTextResult>();
    queueHandle({ removal: exit.promise });
    queueHandle({});
    const onExitComplete = vi.fn();
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        onExitComplete={onExitComplete}
      />,
    );
    const previous = issuedHandles[0]!;

    rerender(
      <YuragiText
        text="B"
        outline={nextOutline}
        animation={{ speed: 0.8 }}
        onExitComplete={onExitComplete}
      />,
    );

    expect(previous.remove).toHaveBeenCalledWith({ speed: 0.8 });
    expect(previous.remove.mock.invocationCallOrder[0]).toBeLessThan(
      coreMocks.renderYuragiText.mock.invocationCallOrder[1]!,
    );
    expect(issuedHandles[1]?.play).toHaveBeenCalledOnce();
    expect(onExitComplete).not.toHaveBeenCalled();

    exit.resolve({ status: "completed" });
    await waitFor(() => expect(onExitComplete).toHaveBeenCalledOnce());
  });

  it("replaces without removal when exit animation is disabled", () => {
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ exit: false }}
      />,
    );
    const previous = issuedHandles[0]!;

    rerender(
      <YuragiText
        text="B"
        outline={nextOutline}
        animation={{ exit: false }}
      />,
    );

    expect(previous.remove).not.toHaveBeenCalled();
    expect(coreMocks.renderYuragiText).toHaveBeenCalledTimes(2);
  });

  it("updates styles on rerender", () => {
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        style={{ color: "red" }}
      />,
    );

    rerender(
      <YuragiText
        text="A"
        outline={outline}
        style={{ color: "blue" }}
      />,
    );

    expect(issuedHandles[0]?.element.style.color).toBe("blue");
  });

  it("updates hover effects without recreating the SVG", () => {
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        hover="none"
        hoverMotion={false}
      />,
    );
    const handle = issuedHandles[0]!;

    rerender(
      <YuragiText
        text="A"
        outline={outline}
        hover="outline"
        hoverMotion
      />,
    );

    expect(handle.element.dataset.hover).toBe("outline");
    expect(handle.element.dataset.hoverMotion).toBe("true");
    expect(coreMocks.renderYuragiText).toHaveBeenCalledOnce();
    expect(handle.play).toHaveBeenCalledOnce();
  });

  it.each([
    { status: "completed" },
    { status: "skipped", reason: "empty" },
  ] satisfies YuragiTextResult[])(
    "invokes onEnterComplete for a $status result",
    async (result) => {
      queueHandle({ playback: result });
      const onEnterComplete = vi.fn();

      render(
        <YuragiText
          text="A"
          outline={outline}
          onEnterComplete={onEnterComplete}
        />,
      );

      await waitFor(() => expect(onEnterComplete).toHaveBeenCalledOnce());
    },
  );

  it.each([
    { status: "cancelled" },
    {
      status: "failed",
      error: new YuragiTextError("enter", new Error("failed")),
    },
  ] satisfies YuragiTextResult[])(
    "does not invoke onEnterComplete for a $status result",
    async (result) => {
      queueHandle({ playback: result });
      const onEnterComplete = vi.fn();

      render(
        <YuragiText
          text="A"
          outline={outline}
          onEnterComplete={onEnterComplete}
        />,
      );
      await Promise.resolve();

      expect(onEnterComplete).not.toHaveBeenCalled();
    },
  );

  it("uses the latest committed completion callback", async () => {
    const enter = deferred<YuragiTextResult>();
    queueHandle({ playback: enter.promise });
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        onEnterComplete={firstCallback}
      />,
    );

    rerender(
      <YuragiText
        text="A"
        outline={outline}
        onEnterComplete={latestCallback}
      />,
    );
    enter.resolve({ status: "completed" });

    await waitFor(() => expect(latestCallback).toHaveBeenCalledOnce());
    expect(firstCallback).not.toHaveBeenCalled();
  });

  it("starts removal on unmount and reports its completion", async () => {
    const exit = deferred<YuragiTextResult>();
    queueHandle({ removal: exit.promise });
    const onExitComplete = vi.fn();
    const { unmount } = render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ speed: 0.8 }}
        onExitComplete={onExitComplete}
      />,
    );
    const handle = issuedHandles[0]!;

    unmount();

    expect(handle.remove).toHaveBeenCalledWith({ speed: 0.8 });
    exit.resolve({ status: "completed" });
    await waitFor(() => expect(onExitComplete).toHaveBeenCalledOnce());
  });

  it("disposes immediately on unmount when exit is disabled", () => {
    const { unmount } = render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ exit: false }}
      />,
    );
    const handle = issuedHandles[0]!;

    unmount();

    expect(handle.remove).not.toHaveBeenCalled();
    expect(handle.dispose).toHaveBeenCalledOnce();
  });

  it("cancels StrictMode's provisional exit before paint", async () => {
    const onExitComplete = vi.fn();

    render(
      <StrictMode>
        <YuragiText
          text="A"
          outline={outline}
          onExitComplete={onExitComplete}
        />
      </StrictMode>,
    );
    await Promise.resolve();

    expect(document.querySelectorAll("[data-yuragi-root]")).toHaveLength(1);
    expect(issuedHandles[0]?.dispose).toHaveBeenCalledOnce();
    expect(onExitComplete).not.toHaveBeenCalled();
  });

  it("renders the default text fallback with the requested layout", () => {
    render(
      <YuragiText
        text="Missing"
        size={88}
        maxWidth={360}
        align="center"
        className="title"
        style={{ color: "red" }}
      />,
    );

    const fallback = screen.getByText("Missing");
    expect(fallback.className).toBe("title");
    expect(fallback.style.color).toBe("red");
    expect(fallback.style.fontSize).toBe("88px");
    expect(fallback.style.maxWidth).toBe("360px");
    expect(fallback.style.textAlign).toBe("center");
    expect(coreMocks.renderYuragiText).not.toHaveBeenCalled();
  });

  it("reserves fallback layout while hidden", () => {
    render(
      <YuragiText
        text="Missing"
        size={88}
        maxWidth={360}
        align="center"
        className="title"
        style={{ color: "red" }}
        fallback="hidden"
      />,
    );

    const fallback = screen.getByText("Missing");
    expect(fallback.getAttribute("aria-hidden")).toBe("true");
    expect(fallback.className).toBe("title");
    expect(fallback.style.visibility).toBe("hidden");
    expect(fallback.style.color).toBe("red");
    expect(fallback.style.fontSize).toBe("88px");
    expect(fallback.style.lineHeight).toBe("1.2");
    expect(fallback.style.maxWidth).toBe("360px");
    expect(fallback.style.textAlign).toBe("center");
    expect(coreMocks.renderYuragiText).not.toHaveBeenCalled();
  });

  it("throws for an error fallback", () => {
    expect(() =>
      render(<YuragiText text="Missing" fallback="error" />),
    ).toThrow('Missing yuragi outline for "Missing"');
  });
});
