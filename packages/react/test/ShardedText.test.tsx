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

describe("ShardedText", () => {
  afterEach(async () => {
    cleanup();
    await Promise.resolve();
    vi.mocked(animateShards).mockClear();
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
        transition={{ exit: "scatter" }}
      />,
    );

    rerender(
      <ShardedText
        text="A"
        outline={outline}
        style={{ color: "red" }}
        transition={{ exit: "scatter" }}
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
