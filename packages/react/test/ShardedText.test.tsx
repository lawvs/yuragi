import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShardedText } from "../src/ShardedText";
import { animateShards, type TextOutline } from "@type-shards/core";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    ViewTransition: ({
      children,
      name,
    }: {
      children: React.ReactNode;
      name: string;
    }) => <div data-view-transition={name}>{children}</div>,
  };
});

vi.mock("@type-shards/core", async () => {
  const actual = await vi.importActual<typeof import("@type-shards/core")>(
    "@type-shards/core",
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

describe("ShardedText", () => {
  afterEach(async () => {
    cleanup();
    await Promise.resolve();
    document
      .querySelectorAll("[data-type-shards-exit]")
      .forEach((node) => node.remove());
    vi.mocked(animateShards).mockClear();
    vi.mocked(animateShards).mockImplementation(async () => undefined);
  });

  function expectNoScatterCall() {
    expect(animateShards).not.toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "scatter",
    });
  }

  it("renders SVG when outline exists", () => {
    render(<ShardedText text="A" outline={outline} size={24} />);

    expect(document.querySelector("[data-type-shards-root]")).not.toBeNull();
  });

  it("renders text fallback by default when outline is missing", () => {
    render(<ShardedText text="Missing" />);

    expect(screen.getByText("Missing")).not.toBeNull();
  });

  it("styles text fallback with the same layout inputs as sharded text", () => {
    render(
      <ShardedText
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
      render(<ShardedText text="Missing" fallback="error" />),
    ).toThrow('Missing type-shards outline for "Missing"');
  });

  it("wraps with ViewTransition when sharedId is provided", () => {
    render(
      <ShardedText
        text="A"
        outline={outline}
        sharedId="title:a"
        size={24}
      />,
    );

    expect(
      document.querySelector('[data-view-transition="title:a"]'),
    ).not.toBeNull();
  });

  it("wraps text fallback with ViewTransition when sharedId is provided", () => {
    render(<ShardedText text="Missing" sharedId="title:missing" />);

    const transition = document.querySelector(
      '[data-view-transition="title:missing"]',
    );
    expect(transition).not.toBeNull();
    expect(transition?.textContent).toBe("Missing");
  });

  it("animates shards with settle transition on enter", () => {
    render(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ enter: "settle" }}
      />,
    );

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "settle",
      stagger: "by-x",
    });
  });

  it("passes custom enter duration to settle animation", () => {
    render(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ enter: "settle", enterDuration: 640 }}
      />,
    );

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "settle",
      stagger: "by-x",
      duration: 640,
    });
  });

  it("animates shards with scatter transition on exit", async () => {
    const { unmount } = render(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ exit: "scatter" }}
      />,
    );

    unmount();
    await Promise.resolve();

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "scatter",
    });
  });

  it("passes custom exit duration to scatter animation", async () => {
    const { unmount } = render(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ exit: "scatter", exitDuration: 560 }}
      />,
    );

    unmount();
    await Promise.resolve();

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "scatter",
      duration: 560,
    });
  });

  it("animates a fixed viewport clone when outline changes", async () => {
    const scatterFinished = deferred<void>();
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
        <ShardedText
          text="A"
          outline={outline}
          transition={{ enter: "settle", exit: "scatter" }}
        />,
      );
      const previousSvg = document.querySelector<SVGSVGElement>(
        "[data-type-shards-root]",
      );
      expect(previousSvg).not.toBeNull();

      rerender(
        <ShardedText
          text="B"
          outline={nextOutline}
          transition={{
            enter: "settle",
            exit: "scatter",
            enterDuration: 640,
            exitDuration: 560,
          }}
        />,
      );

      const scatterCall = vi
        .mocked(animateShards)
        .mock.calls.find(([, options]) => options.type === "scatter");
      const exitSvg = scatterCall?.[0] as SVGSVGElement | undefined;

      expect(exitSvg).toBeDefined();
      expect(exitSvg).not.toBe(previousSvg);
      expect(exitSvg?.parentElement).toBe(document.body);
      expect(exitSvg?.dataset.typeShardsExit).toBe("true");
      expect(exitSvg?.style.position).toBe("fixed");
      expect(exitSvg?.style.left).toBe("24px");
      expect(exitSvg?.style.top).toBe("36px");
      expect(exitSvg?.style.width).toBe("180px");
      expect(exitSvg?.style.height).toBe("54px");
      expect(exitSvg?.style.pointerEvents).toBe("none");
      expect(exitSvg?.style.getPropertyValue("view-transition-name")).toBe(
        "none",
      );
      expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
        type: "settle",
        stagger: "by-x",
        duration: 640,
      });
      expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
        type: "scatter",
        duration: 560,
      });
      expect(document.querySelectorAll("[data-type-shards-root]")).toHaveLength(
        2,
      );
      expect(previousSvg?.isConnected).toBe(false);

      scatterFinished.resolve();
      await scatterFinished.promise;
      await Promise.resolve();

      expect(document.querySelectorAll("[data-type-shards-root]")).toHaveLength(
        1,
      );
    } finally {
      getBoundingClientRect.mockRestore();
    }
  });

  it("animates a fixed viewport clone when unmounted", async () => {
    const scatterFinished = deferred<void>();
    vi.mocked(animateShards).mockImplementation(async (root, options) => {
      if (options.type === "scatter") {
        await scatterFinished.promise;
      }
      void root;
    });

    const { unmount } = render(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ exit: "scatter" }}
      />,
    );
    const previousSvg = document.querySelector<SVGSVGElement>(
      "[data-type-shards-root]",
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
    expect(exitSvg?.dataset.typeShardsExit).toBe("true");
    expect(exitSvg?.style.left).toBe("12px");
    expect(exitSvg?.style.top).toBe("18px");
    expect(exitSvg?.style.width).toBe("90px");
    expect(exitSvg?.style.height).toBe("40px");

    scatterFinished.resolve();
    await scatterFinished.promise;
    await Promise.resolve();

    expect(exitSvg?.isConnected).toBe(false);
  });

  it("does not scatter during StrictMode initial mount", async () => {
    render(
      <React.StrictMode>
        <ShardedText
          text="A"
          outline={outline}
          transition={{ enter: "settle", exit: "scatter" }}
        />
      </React.StrictMode>,
    );
    await Promise.resolve();

    expectNoScatterCall();
  });

  it("does not scatter when exit transition changes to none", async () => {
    const { rerender } = render(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ exit: "scatter" }}
      />,
    );

    rerender(
      <ShardedText
        text="A"
        outline={outline}
        transition={{ exit: "none" }}
      />,
    );
    await Promise.resolve();

    expectNoScatterCall();
  });

  it("does not scatter when rerendering with a new object prop identity", () => {
    const { rerender } = render(
      <ShardedText
        text="A"
        outline={outline}
        style={{ color: "red" }}
        transition={{ exit: "scatter", exitDuration: 200 }}
      />,
    );

    rerender(
      <ShardedText
        text="A"
        outline={outline}
        style={{ color: "red" }}
        transition={{ exit: "scatter", exitDuration: 560 }}
      />,
    );

    expectNoScatterCall();
  });

  it("serializes numeric SVG styles like React", () => {
    render(
      <ShardedText
        text="A"
        outline={outline}
        style={
          {
            width: 10,
            opacity: 0.5,
            fillOpacity: 0.5,
            strokeOpacity: 0.25,
            strokeWidth: 2,
            "--ts-test": 4,
          } as React.CSSProperties
        }
      />,
    );

    const svg = document.querySelector<SVGSVGElement>(
      "[data-type-shards-root]",
    );
    expect(svg?.style.width).toBe("10px");
    expect(svg?.style.opacity).toBe("0.5");
    expect(svg?.style.fillOpacity).toBe("0.5");
    expect(svg?.style.strokeOpacity).toBe("0.25");
    expect(svg?.style.strokeWidth).toBe("2");
    expect(svg?.style.getPropertyValue("--ts-test")).toBe("4");
  });
});
