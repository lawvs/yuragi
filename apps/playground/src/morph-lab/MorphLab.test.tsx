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

vi.mock("morphicons", () => ({
  fitIcon: (d: string) => `fitted:${d}`,
}));

vi.mock("morphicons/react", () => ({
  MorphIcon: ({ icon }: { icon: string }) => (
    <svg data-morph-icon={icon} />
  ),
}));

function outlineFor(text: string): TextOutline {
  const path =
    text === "A"
      ? "M0 0L500 0L500 -800Z"
      : "M0 0L0 -800L500 -800Z";
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

describe("MorphLab", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    fontMocks.compile.mockReset();
    fontMocks.compile.mockImplementation(outlineFor);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("morphs to the path compiled from the latest input", () => {
    act(() => root.render(<MorphLab />));

    const input = host.querySelector<HTMLInputElement>(
      'input[name="morph-text"]',
    )!;
    const initialIcon = host
      .querySelector("[data-morph-icon]")
      ?.getAttribute("data-morph-icon");

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "B");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(fontMocks.compile).toHaveBeenLastCalledWith("B");
    expect(
      host
        .querySelector("[data-morph-icon]")
        ?.getAttribute("data-morph-icon"),
    ).not.toBe(initialIcon);
  });
});
