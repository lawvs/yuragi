import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextOutline } from "@yuragi-labs/core";
import { MorphLab } from "./MorphLab";

const fontMocks = vi.hoisted(() => ({ compile: vi.fn() }));

vi.mock("@yuragi-labs/react", () => ({
  useYuragiFont: () => ({
    status: "ready",
    ready: true,
    font: { compile: fontMocks.compile },
    error: null,
  }),
}));

vi.mock("morphicons", async () => {
  const actual = await vi.importActual<typeof import("morphicons")>(
    "morphicons",
  );
  return {
    ...actual,
    fitIcon: (d: string) => `fitted:${d}`,
  };
});

vi.mock("morphicons/react", () => ({
  MorphIcon: ({
    fill,
    from,
    icon,
    progress,
    stroke,
    to,
  }: {
    fill?: string;
    from?: string;
    icon?: string;
    progress?: number;
    stroke?: string;
    to?: string;
  }) => (
    <svg
      data-fill={fill}
      data-from={from}
      data-morph-icon={icon ?? to}
      data-progress={progress}
      data-stroke={stroke}
      data-to={to}
    />
  ),
}));

function outlineFor(text: string): TextOutline {
  const path =
    text === "A"
      ? "M0 0L500 0L500 -800Z"
      : text === "B"
        ? "M0 0L0 -800L500 -800Z"
        : "M0 0Q250 -800 500 0Z";
  return {
    em: 1000,
    ascender: 800,
    descender: -200,
    groups: [
      {
        text,
        advance: 500,
        breakAfter: true,
        glyphs: [
          {
            char: text,
            advance: 500,
            bbox: { top: -800, bottom: 0, left: 0, right: 500 },
            shards: [{ path, direction: [1, 0] }],
          },
        ],
      },
    ],
  };
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("MorphLab", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    fontMocks.compile.mockReset();
    fontMocks.compile.mockImplementation(outlineFor);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  it("renders the morph as a solid shape", () => {
    act(() => root.render(<MorphLab />));

    const icon = host.querySelector("[data-morph-icon]");
    expect(icon?.getAttribute("data-fill")).toBe("currentColor");
    expect(icon?.getAttribute("data-stroke")).toBe("none");
  });

  it("morphs only after submitting the latest input", () => {
    act(() => root.render(<MorphLab />));

    const input = host.querySelector<HTMLInputElement>(
      'input[name="morph-text"]',
    )!;
    const submit = host.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const initialIcon = host
      .querySelector("[data-morph-icon]")
      ?.getAttribute("data-morph-icon");

    act(() => {
      changeInput(input, "B");
    });

    expect(fontMocks.compile).toHaveBeenCalledTimes(1);
    expect(
      host
        .querySelector("[data-morph-icon]")
        ?.getAttribute("data-morph-icon"),
    ).toBe(initialIcon);

    act(() => {
      submit?.click();
    });

    expect(fontMocks.compile).toHaveBeenLastCalledWith("B");
    expect(
      host
        .querySelector("[data-morph-icon]")
        ?.getAttribute("data-morph-icon"),
    ).not.toBe(initialIcon);
  });

  it("scrubs from the previous shape to the current shape", () => {
    act(() => root.render(<MorphLab />));

    const input = host.querySelector<HTMLInputElement>(
      'input[name="morph-text"]',
    )!;
    const initialIcon = host
      .querySelector("[data-morph-icon]")
      ?.getAttribute("data-morph-icon");

    act(() => {
      changeInput(input, "B");
    });
    act(() => {
      host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    });
    act(() => {
      vi.runAllTimers();
    });

    const range = host.querySelector<HTMLInputElement>(
      'input[name="morph-progress"]',
    );
    expect(range).not.toBeNull();
    expect(range?.value).toBe("1");

    act(() => {
      changeInput(range!, "0.5");
    });

    const icon = host.querySelector("[data-morph-icon]");
    expect(icon?.getAttribute("data-from")).toBe(initialIcon);
    expect(icon?.getAttribute("data-progress")).toBe("0.5");
    expect(icon?.getAttribute("data-to")).not.toBe(initialIcon);
    expect(host.querySelector("output")?.textContent).toBe("t=0.50");
  });

  it("replays the morph after scrubbing and submitting new text", () => {
    act(() => root.render(<MorphLab />));

    const input = host.querySelector<HTMLInputElement>(
      'input[name="morph-text"]',
    )!;
    const submit = host.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const range = host.querySelector<HTMLInputElement>(
      'input[name="morph-progress"]',
    )!;

    act(() => {
      changeInput(input, "B");
    });
    act(() => {
      submit?.click();
    });
    act(() => {
      vi.runAllTimers();
      changeInput(range, "0.5");
      changeInput(input, "C");
    });
    act(() => {
      submit?.click();
    });

    expect(fontMocks.compile).toHaveBeenLastCalledWith("C");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(range.value).toBe("0");

    act(() => {
      vi.advanceTimersByTime(32);
    });
    expect(Number(range.value)).toBeGreaterThan(0);
    expect(Number(range.value)).toBeLessThan(1);

    act(() => {
      vi.runAllTimers();
    });
    expect(range.value).toBe("1");
  });

  it("keeps the latest valid shape when compilation fails", () => {
    act(() => root.render(<MorphLab />));

    const input = host.querySelector<HTMLInputElement>(
      'input[name="morph-text"]',
    )!;
    const submit = host.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    const initialIcon = host
      .querySelector("[data-morph-icon]")
      ?.getAttribute("data-morph-icon");
    fontMocks.compile.mockImplementationOnce(() => {
      throw new Error("Unsupported text");
    });

    act(() => {
      changeInput(input, "?");
    });
    act(() => {
      submit?.click();
    });

    expect(
      host
        .querySelector("[data-morph-icon]")
        ?.getAttribute("data-morph-icon"),
    ).toBe(initialIcon);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Unsupported text",
    );
  });
});
