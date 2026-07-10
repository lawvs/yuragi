import { StrictMode, type CSSProperties } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YuragiText } from "../src/YuragiText";
import { animateShards, type TextOutline } from "@yuragi/core";
import { clearSharedMotionSnapshots } from "../src/shared-motion";

vi.mock("@yuragi/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi/core")>(
    "@yuragi/core",
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

const twoShardOutline: TextOutline = {
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
            { path: "M0 0L250 0L250 500Z", direction: [1, 0] },
            { path: "M250 0L500 0L500 500Z", direction: [-1, 0] },
          ],
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

function mockSingleShardSharedRects() {
  return vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const root =
        this instanceof SVGSVGElement
          ? this
          : this.closest<SVGSVGElement>("[data-yuragi-root]");
      const width = Number(root?.getAttribute("width") ?? 0);
      if (this instanceof SVGSVGElement) {
        return width === 12
          ? rect(10, 20, 12, 24)
          : rect(100, 80, 24, 48);
      }
      if (this.matches("[data-shard-motion]")) {
        return width === 12 ? rect(12, 25, 4, 8) : rect(110, 95, 8, 16);
      }
      return rect(0, 0, 0, 0);
    });
}

function installElementAnimate(finished: Promise<void> = Promise.resolve()) {
  const animate = vi.fn(() => ({ finished }));
  const originalAnimate = Element.prototype.animate;
  Element.prototype.animate = animate as unknown as Element["animate"];
  return {
    animate,
    restore: () => {
      Element.prototype.animate = originalAnimate;
    },
  };
}

function installTwoShardPathGeometry() {
  const originalGetBBox = (
    SVGElement.prototype as SVGElement & {
      getBBox?: () => DOMRect;
    }
  ).getBBox;
  const originalGetScreenCTM = (
    SVGElement.prototype as SVGElement & {
      getScreenCTM?: () => DOMMatrix;
    }
  ).getScreenCTM;

  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value(this: SVGElement) {
      const d = this.getAttribute("d") ?? "";
      if (d.startsWith("M250")) return rect(250, 0, 250, 500);
      return rect(0, 0, 250, 500);
    },
  });
  Object.defineProperty(SVGElement.prototype, "getScreenCTM", {
    configurable: true,
    value(this: SVGElement) {
      const root = this.closest<SVGSVGElement>("[data-yuragi-root]");
      const width = Number(root?.getAttribute("width") ?? 0);
      const scale = width === 12 ? 0.024 : 0.048;
      const offset = width === 12 ? { x: 10, y: 20 } : { x: 100, y: 80 };
      return {
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        e: offset.x,
        f: offset.y,
      } as DOMMatrix;
    },
  });

  return () => {
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: originalGetBBox,
    });
    Object.defineProperty(SVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: originalGetScreenCTM,
    });
  };
}

describe("YuragiText", () => {
  afterEach(async () => {
    cleanup();
    await Promise.resolve();
    document
      .querySelectorAll("[data-yuragi-exit]")
      .forEach((node) => node.remove());
    clearSharedMotionSnapshots();
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

  it("renders text fallback by default when outline is missing", () => {
    render(<YuragiText text="Missing" />);

    expect(screen.getByText("Missing")).not.toBeNull();
  });

  it("styles text fallback with the same layout inputs as sharded text", () => {
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

  it("renders shared text without a ViewTransition wrapper", () => {
    render(
      <YuragiText
        text="A"
        outline={outline}
        sharedId="title:a"
        size={24}
      />,
    );

    expect(document.querySelector("[data-yuragi-root]")).not.toBeNull();
    expect(document.querySelector("[data-view-transition]")).toBeNull();
  });

  it("renders text fallback plainly when sharedId is provided", () => {
    render(<YuragiText text="Missing" sharedId="title:missing" />);

    expect(screen.getByText("Missing")).not.toBeNull();
    expect(document.querySelector("[data-view-transition]")).toBeNull();
  });

  it("animates shards with settle transition on enter", () => {
    render(
      <YuragiText
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

  it("passes transition speed to settle animation", () => {
    render(
      <YuragiText
        text="A"
        outline={outline}
        transition={{ enter: "settle", speed: 0.8 }}
      />,
    );

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "settle",
      stagger: "by-x",
      speed: 0.8,
    });
  });

  it("animates shards with scatter transition on exit", async () => {
    const { unmount } = render(
      <YuragiText
        text="A"
        outline={outline}
        transition={{ exit: "scatter" }}
      />,
    );

    unmount();
    await Promise.resolve();

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "scatter",
      stagger: "by-x",
    });
  });

  it("passes transition speed to scatter animation", async () => {
    const { unmount } = render(
      <YuragiText
        text="A"
        outline={outline}
        transition={{ exit: "scatter", speed: 0.8 }}
      />,
    );

    unmount();
    await Promise.resolve();

    expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
      type: "scatter",
      stagger: "by-x",
      speed: 0.8,
    });
  });

  it("animates shared shards from a captured source snapshot", async () => {
    const animationFinished = deferred<void>();
    const { animate, restore } = installElementAnimate(
      animationFinished.promise,
    );
    const getBoundingClientRect = mockSingleShardSharedRects();

    try {
      const { rerender } = render(
        <section>
          <YuragiText
            text="A"
            outline={outline}
            sharedId="title:a"
            size={24}
          />
          <YuragiText text="A" outline={outline} sharedId={false} size={48} />
        </section>,
      );
      const sourceSvg = document.querySelector<SVGSVGElement>(
        '[width="12"][data-yuragi-root]',
      );
      expect(sourceSvg).not.toBeNull();

      rerender(
        <section>
          <YuragiText text="A" outline={outline} sharedId={false} size={24} />
          <YuragiText
            text="A"
            outline={outline}
            sharedId="title:a"
            size={48}
            transition={{ enter: "settle", speed: 0.5 }}
          />
        </section>,
      );
      await Promise.resolve();

      expect(animate).toHaveBeenCalledTimes(1);
      expect(animate).toHaveBeenCalledWith(
        [
          {
            transform: "translate(-100px, -74px) scale(0.5)",
          },
          {},
        ],
        {
          duration: 1000,
          delay: 0,
          easing: "cubic-bezier(0, 0, 0, 1)",
          fill: "both",
        },
      );
      expect(sourceSvg?.style.visibility).toBe("hidden");
      expect(animateShards).not.toHaveBeenCalled();

      animationFinished.resolve();
      await animationFinished.promise;
      await Promise.resolve();
      await Promise.resolve();

      expect(sourceSvg?.style.visibility).toBe("");
    } finally {
      restore();
      getBoundingClientRect.mockRestore();
    }
  });

  it("uses shared motion when the same sharedId changes layout", async () => {
    const { animate, restore } = installElementAnimate();
    const getBoundingClientRect = mockSingleShardSharedRects();

    try {
      const { rerender } = render(
        <YuragiText
          text="A"
          outline={outline}
          sharedId="title:a"
          size={24}
        />,
      );

      rerender(
        <YuragiText
          text="A"
          outline={outline}
          sharedId="title:a"
          size={48}
          transition={{ enter: "settle", exit: "scatter", speed: 0.5 }}
        />,
      );
      await Promise.resolve();

      expect(animate).toHaveBeenCalledTimes(1);
      expect(animateShards).not.toHaveBeenCalled();
    } finally {
      restore();
      getBoundingClientRect.mockRestore();
    }
  });

  it("moves shared motion by shard path instead of whole glyph bounds", async () => {
    const { animate, restore } = installElementAnimate();
    const restorePathGeometry = installTwoShardPathGeometry();
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const root =
          this instanceof SVGSVGElement
            ? this
            : this.closest<SVGSVGElement>("[data-yuragi-root]");
        const width = Number(root?.getAttribute("width") ?? 0);
        if (this instanceof SVGSVGElement) {
          return width === 12
            ? rect(10, 20, 12, 24)
            : rect(100, 80, 24, 48);
        }
        if (this.matches("[data-shard-motion]")) {
          return width === 12 ? rect(10, 20, 12, 24) : rect(100, 80, 24, 48);
        }
        return rect(0, 0, 0, 0);
      });

    try {
      const { rerender } = render(
        <section>
          <YuragiText
            text="A"
            outline={twoShardOutline}
            sharedId="title:a"
            size={24}
          />
          <YuragiText
            text="A"
            outline={twoShardOutline}
            sharedId={false}
            size={48}
          />
        </section>,
      );

      rerender(
        <section>
          <YuragiText
            text="A"
            outline={twoShardOutline}
            sharedId={false}
            size={24}
          />
          <YuragiText
            text="A"
            outline={twoShardOutline}
            sharedId="title:a"
            size={48}
            transition={{ enter: "settle", speed: 1 }}
          />
        </section>,
      );
      await Promise.resolve();

      const animateCalls = animate.mock.calls as unknown as Array<
        [Keyframe[] | PropertyIndexedKeyframes | null]
      >;
      const transforms = animateCalls.map(([keyframes]) => {
        const [first] = keyframes as Keyframe[];
        return first.transform;
      });
      expect(transforms).toEqual([
        "translate(-93px, -66px) scale(0.5)",
        "translate(-99px, -66px) scale(0.5)",
      ]);
    } finally {
      restore();
      restorePathGeometry();
      getBoundingClientRect.mockRestore();
    }
  });

  it("falls back to settle for shared motion when reduced motion is requested", async () => {
    const getBoundingClientRect = mockSingleShardSharedRects();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    try {
      const { rerender } = render(
        <section>
          <YuragiText
            text="A"
            outline={outline}
            sharedId="title:a"
            size={24}
          />
          <YuragiText text="A" outline={outline} sharedId={false} size={48} />
        </section>,
      );

      rerender(
        <section>
          <YuragiText text="A" outline={outline} sharedId={false} size={24} />
          <YuragiText
            text="A"
            outline={outline}
            sharedId="title:a"
            size={48}
            transition={{ enter: "settle", speed: 0.7 }}
          />
        </section>,
      );
      await Promise.resolve();

      expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
        type: "settle",
        stagger: "by-x",
        speed: 0.7,
      });
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
      getBoundingClientRect.mockRestore();
    }
  });

  it("falls back to settle when shared shard counts do not match", async () => {
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (this instanceof SVGSVGElement) return rect(10, 20, 12, 24);
        if (this.matches("[data-shard-motion]")) return rect(12, 25, 4, 8);
        return rect(0, 0, 0, 0);
      });

    try {
      const { rerender } = render(
        <section>
          <YuragiText
            text="A"
            outline={outline}
            sharedId="title:a"
            size={24}
          />
          <YuragiText
            text="A"
            outline={twoShardOutline}
            sharedId={false}
            size={48}
          />
        </section>,
      );
      const sourceSvg = document.querySelector<SVGSVGElement>(
        '[width="12"][data-yuragi-root]',
      );

      rerender(
        <section>
          <YuragiText text="A" outline={outline} sharedId={false} size={24} />
          <YuragiText
            text="A"
            outline={twoShardOutline}
            sharedId="title:a"
            size={48}
            transition={{ enter: "settle", speed: 0.7 }}
          />
        </section>,
      );
      await Promise.resolve();

      expect(sourceSvg?.style.visibility).toBe("");
      expect(animateShards).toHaveBeenCalledWith(expect.any(SVGSVGElement), {
        type: "settle",
        stagger: "by-x",
        speed: 0.7,
      });
    } finally {
      getBoundingClientRect.mockRestore();
    }
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
        <YuragiText
          text="A"
          outline={outline}
          transition={{ enter: "settle", exit: "scatter" }}
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
          transition={{
            enter: "settle",
            exit: "scatter",
            speed: 0.8,
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
      expect(exitSvg?.dataset.yuragiExit).toBe("true");
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

      scatterFinished.resolve();
      await scatterFinished.promise;
      await Promise.resolve();

      expect(document.querySelectorAll("[data-yuragi-root]")).toHaveLength(
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
      <YuragiText
        text="A"
        outline={outline}
        transition={{ exit: "scatter" }}
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

    scatterFinished.resolve();
    await scatterFinished.promise;
    await Promise.resolve();

    expect(exitSvg?.isConnected).toBe(false);
  });

  it("does not scatter during StrictMode initial mount", async () => {
    render(
      <StrictMode>
        <YuragiText
          text="A"
          outline={outline}
          transition={{ enter: "settle", exit: "scatter" }}
        />
      </StrictMode>,
    );
    await Promise.resolve();

    expectNoScatterCall();
  });

  it("does not scatter when exit transition changes to none", async () => {
    const { rerender } = render(
      <YuragiText
        text="A"
        outline={outline}
        transition={{ exit: "scatter" }}
      />,
    );

    rerender(
      <YuragiText
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
      <YuragiText
        text="A"
        outline={outline}
        style={{ color: "red" }}
        transition={{ exit: "scatter", speed: 1 }}
      />,
    );

    rerender(
      <YuragiText
        text="A"
        outline={outline}
        style={{ color: "red" }}
        transition={{ exit: "scatter", speed: 0.8 }}
      />,
    );

    expectNoScatterCall();
  });

  it("serializes numeric SVG styles like React", () => {
    render(
      <YuragiText
        text="A"
        outline={outline}
        style={
          {
            width: 10,
            opacity: 0.5,
            fillOpacity: 0.5,
            strokeOpacity: 0.25,
            strokeWidth: 2,
            "--yuragi-test": 4,
          } as CSSProperties
        }
      />,
    );

    const svg = document.querySelector<SVGSVGElement>(
      "[data-yuragi-root]",
    );
    expect(svg?.style.width).toBe("10px");
    expect(svg?.style.opacity).toBe("0.5");
    expect(svg?.style.fillOpacity).toBe("0.5");
    expect(svg?.style.strokeOpacity).toBe("0.25");
    expect(svg?.style.strokeWidth).toBe("2");
    expect(svg?.style.getPropertyValue("--yuragi-test")).toBe("4");
  });
});
