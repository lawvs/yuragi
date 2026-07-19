import {
  startTransition,
  StrictMode,
  Suspense,
  type ComponentProps,
} from "react";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YuragiText } from "../src/YuragiText";
import { animateShards, type TextOutline } from "@yuragi-labs/core";

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return {
    ...actual,
    animateShards: vi.fn(async () => undefined),
  };
});

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

const nextOutline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [
    {
      text: "B",
      advance: 520,
      breakAfter: true,
      glyphs: [
        {
          char: "B",
          advance: 520,
          bbox: { top: -800, bottom: 200, left: 0, right: 520 },
          shards: [{ path: "M0 0L520 0L520 500Z", direction: [-1, 0] }],
        },
      ],
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const never = new Promise<never>(() => undefined);

function SuspendForever(): never {
  throw never;
}

function SuspendingYuragiText({
  suspend,
  ...props
}: ComponentProps<typeof YuragiText> & { suspend: boolean }) {
  return (
    <Suspense fallback="Loading">
      <YuragiText {...props} />
      {suspend ? <SuspendForever /> : null}
    </Suspense>
  );
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

describe("YuragiText", () => {
  afterEach(async () => {
    cleanup();
    await Promise.resolve();
    document
      .querySelectorAll("[data-yuragi-exit]")
      .forEach((node) => node.remove());
    vi.mocked(animateShards).mockClear();
    vi.mocked(animateShards).mockImplementation(async () => undefined);
  });

  function expectNoScatterCall() {
    expect(
      vi
        .mocked(animateShards)
        .mock.calls.some(([, options]) => options.type === "scatter"),
    ).toBe(false);
  }

  it("renders SVG when outline exists", () => {
    render(<YuragiText text="A" outline={outline} size={24} />);

    expect(document.querySelector("[data-yuragi-root]")).not.toBeNull();
  });

  it("settles shards by default", () => {
    render(<YuragiText text="A" outline={outline} />);

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "settle",
      stagger: "by-x",
      speed: undefined,
    });
  });

  it("disables enter and exit animations with animation false", async () => {
    const { rerender } = render(
      <YuragiText text="A" outline={outline} animation={false} />,
    );

    rerender(
      <YuragiText text="B" outline={nextOutline} animation={false} />,
    );
    await Promise.resolve();

    expect(animateShards).not.toHaveBeenCalled();
  });

  it("disables only the requested animation phase", async () => {
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ enter: false }}
      />,
    );

    rerender(
      <YuragiText
        text="B"
        outline={nextOutline}
        animation={{ enter: false }}
      />,
    );
    await Promise.resolve();

    const animationTypes = vi
      .mocked(animateShards)
      .mock.calls.map(([, options]) => options.type);
    expect(animationTypes).toEqual(["scatter"]);
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
    expect(fallback.style.display).toBe("block");
    expect(fallback.style.fontSize).toBe("88px");
    expect(fallback.style.lineHeight).toBe("1.2");
    expect(fallback.style.maxWidth).toBe("360px");
    expect(fallback.style.textAlign).toBe("center");
  });

  it("throws when fallback is error and outline is missing", () => {
    expect(() =>
      render(<YuragiText text="Missing" fallback="error" />),
    ).toThrow('Missing yuragi outline for "Missing"');
  });

  it("passes custom speed to the default settle animation", () => {
    render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ speed: 0.8 }}
      />,
    );

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "settle",
      stagger: "by-x",
      speed: 0.8,
    });
  });

  it("calls onEnterComplete once after settle finishes in StrictMode", async () => {
    const settleFinished = deferred<void>();
    const onEnterComplete = vi.fn();
    vi.mocked(animateShards).mockImplementation(async (_root, options) => {
      if (options.type === "settle") {
        await settleFinished.promise;
      }
    });

    render(
      <StrictMode>
        <YuragiText
          text="A"
          outline={outline}
          onEnterComplete={onEnterComplete}
        />
      </StrictMode>,
    );

    expect(onEnterComplete).not.toHaveBeenCalled();

    settleFinished.resolve();
    await settleFinished.promise;
    await Promise.resolve();

    expect(onEnterComplete).toHaveBeenCalledOnce();
  });

  it("uses the latest committed completion callback", async () => {
    const settleFinished = deferred<void>();
    const committedCallback = vi.fn();
    const suspendedCallback = vi.fn();
    vi.mocked(animateShards).mockImplementation(async (_root, options) => {
      if (options.type === "settle") {
        await settleFinished.promise;
      }
    });

    const { rerender } = render(
      <SuspendingYuragiText
        text="A"
        outline={outline}
        onEnterComplete={committedCallback}
        suspend={false}
      />,
    );

    act(() => {
      startTransition(() => {
        rerender(
          <SuspendingYuragiText
            text="A"
            outline={outline}
            onEnterComplete={suspendedCallback}
            suspend
          />,
        );
      });
    });

    expect(screen.queryByText("Loading")).toBeNull();

    await act(async () => {
      settleFinished.resolve();
      await settleFinished.promise;
    });

    expect(suspendedCallback).not.toHaveBeenCalled();
    expect(committedCallback).toHaveBeenCalledOnce();
  });

  it("animates a fixed viewport clone when outline changes", async () => {
    const scatterFinished = deferred<void>();
    const onExitComplete = vi.fn();
    let rootRectCalls = 0;
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (!(this instanceof SVGSVGElement)) return rect(0, 0, 0, 0);
        rootRectCalls += 1;
        if (rootRectCalls === 1) return rect(24, 36, 180, 54);
        if (rootRectCalls === 2) return rect(24, 96, 0, 0);
        return rect(240, 80, 120, 48);
      });
    vi.mocked(animateShards).mockImplementation(async (root, options) => {
      if (options.type === "scatter") {
        await scatterFinished.promise;
      }
      void root;
    });

    try {
      const { rerender } = render(
        <YuragiText
          text="A"
          outline={outline}
          onExitComplete={onExitComplete}
        />,
      );
      const previousSvg = document.querySelector<SVGSVGElement>(
        "[data-yuragi-root]",
      );
      expect(previousSvg).not.toBeNull();

      rerender(
        <YuragiText
          text="B"
          outline={nextOutline}
          animation={{ speed: 0.8 }}
          onExitComplete={onExitComplete}
        />,
      );

      const scatterCall = vi
        .mocked(animateShards)
        .mock.calls.find(([, options]) => options.type === "scatter");
      const exitSvg = scatterCall?.[0] as SVGSVGElement | undefined;

      expect(exitSvg).toBeDefined();
      expect(exitSvg).not.toBe(previousSvg);
      expect(exitSvg?.parentElement).toBe(document.body);
      expect(exitSvg?.dataset.yuragiExit).toBe("true");
      expect(exitSvg?.style.position).toBe("fixed");
      expect(exitSvg?.style.left).toBe("24px");
      expect(exitSvg?.style.top).toBe("36px");
      expect(exitSvg?.style.width).toBe("180px");
      expect(exitSvg?.style.height).toBe("54px");
      expect(exitSvg?.style.pointerEvents).toBe("none");
      expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
        type: "settle",
        stagger: "by-x",
        speed: 0.8,
      });
      expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
        type: "scatter",
        stagger: "by-x",
        speed: 0.8,
      });
      expect(document.querySelectorAll("[data-yuragi-root]")).toHaveLength(
        2,
      );
      expect(previousSvg?.isConnected).toBe(false);
      expect(onExitComplete).not.toHaveBeenCalled();

      scatterFinished.resolve();
      await scatterFinished.promise;
      await Promise.resolve();

      expect(document.querySelectorAll("[data-yuragi-root]")).toHaveLength(
        1,
      );
      await waitFor(() => expect(onExitComplete).toHaveBeenCalledOnce());
    } finally {
      getBoundingClientRect.mockRestore();
    }
  });

  it("animates a fixed viewport clone when unmounted", async () => {
    const scatterFinished = deferred<void>();
    const onExitComplete = vi.fn();
    vi.mocked(animateShards).mockImplementation(async (root, options) => {
      if (options.type === "scatter") {
        await scatterFinished.promise;
      }
      void root;
    });

    const { unmount } = render(
      <YuragiText
        text="A"
        outline={outline}
        onExitComplete={onExitComplete}
      />,
    );
    const previousSvg = document.querySelector<SVGSVGElement>(
      "[data-yuragi-root]",
    );
    expect(previousSvg).not.toBeNull();
    vi.spyOn(previousSvg!, "getBoundingClientRect").mockReturnValue(
      rect(12, 18, 90, 40),
    );

    unmount();
    await Promise.resolve();

    const scatterCall = vi
      .mocked(animateShards)
      .mock.calls.find(([, options]) => options.type === "scatter");
    const exitSvg = scatterCall?.[0] as SVGSVGElement | undefined;

    expect(exitSvg).toBeDefined();
    expect(exitSvg).not.toBe(previousSvg);
    expect(exitSvg?.parentElement).toBe(document.body);
    expect(exitSvg?.dataset.yuragiExit).toBe("true");
    expect(exitSvg?.style.left).toBe("12px");
    expect(exitSvg?.style.top).toBe("18px");
    expect(exitSvg?.style.width).toBe("90px");
    expect(exitSvg?.style.height).toBe("40px");
    expect(onExitComplete).not.toHaveBeenCalled();

    scatterFinished.resolve();
    await scatterFinished.promise;
    await Promise.resolve();

    expect(exitSvg?.isConnected).toBe(false);
    await waitFor(() => expect(onExitComplete).toHaveBeenCalledOnce());
  });

  it("uses the latest committed exit animation when unmounted", async () => {
    const { rerender, unmount } = render(
      <SuspendingYuragiText
        text="A"
        outline={outline}
        animation={{ speed: 0.8 }}
        suspend={false}
      />,
    );

    act(() => {
      startTransition(() => {
        rerender(
          <SuspendingYuragiText
            text="A"
            outline={outline}
            animation={{ exit: false, speed: 0.8 }}
            suspend
          />,
        );
      });
    });

    expect(screen.queryByText("Loading")).toBeNull();

    unmount();
    await Promise.resolve();

    expect(animateShards).toHaveBeenCalledWith(
      expect.any(SVGSVGElement),
      {
        type: "scatter",
        stagger: "by-x",
        speed: 0.8,
      },
    );
  });

  it("does not scatter during StrictMode initial mount", async () => {
    render(
      <StrictMode>
        <YuragiText text="A" outline={outline} />
      </StrictMode>,
    );
    await Promise.resolve();

    expectNoScatterCall();
  });

  it("does not scatter when the exit animation is disabled", async () => {
    const { rerender } = render(<YuragiText text="A" outline={outline} />);

    rerender(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ exit: false }}
      />,
    );
    await Promise.resolve();

    expectNoScatterCall();
  });

  it("does not scatter when the exit animation is enabled", async () => {
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        animation={{ exit: false }}
      />,
    );
    vi.mocked(animateShards).mockClear();

    rerender(<YuragiText text="A" outline={outline} />);
    await Promise.resolve();

    expectNoScatterCall();
  });

  it("does not scatter when rerendering with a new object prop identity", () => {
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
        style={{ color: "red" }}
        animation={{ speed: 0.8 }}
      />,
    );

    expectNoScatterCall();
  });
});
