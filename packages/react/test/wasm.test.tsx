import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YuragiFontProvider, YuragiText } from "../src/index";
import { createYuragiFont } from "@yuragi/wasm";
import type { TextOutline } from "@yuragi/core";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

vi.mock("@yuragi/wasm", () => ({
  createYuragiFont: vi.fn(),
}));

vi.mock("../src/YuragiText", () => ({
  YuragiText: ({
    text,
    outline,
    fallback,
    sharedId,
  }: {
    text: string;
    outline?: TextOutline;
    fallback?: string;
    sharedId?: string | false;
  }) => (
    <span
      data-fallback={fallback}
      data-has-outline={outline ? "yes" : "no"}
      data-sharded-text={text}
      data-shared-id={sharedId || undefined}
    >
      {text}
    </span>
  ),
}));

describe("@yuragi/react runtime", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(createYuragiFont).mockReset();
  });

  it("loads a font provider and resolves outlines for YuragiText", async () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(async () => outline),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    vi.mocked(createYuragiFont).mockResolvedValue(font);

    render(
      <YuragiFontProvider
        font={new Uint8Array([1, 2, 3])}
        axes={{ wght: 900 }}
        preload={["复杂分层"]}
      >
        <YuragiText
          text="复杂分层"
          fallback="text"
          sharedId="title:runtime"
        />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("复杂分层").dataset.hasOutline).toBe("no");

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(createYuragiFont).toHaveBeenCalledWith({
      font: expect.any(Uint8Array),
      axes: { wght: 900 },
      wasm: undefined,
      preload: ["复杂分层"],
    });
    expect(font.compile).toHaveBeenCalledWith("复杂分层");
    expect(screen.getByText("复杂分层").dataset.hasOutline).toBe("yes");
    expect(screen.getByText("复杂分层").dataset.sharedId).toBe(
      "title:runtime",
    );

    cleanup();
    expect(font.dispose).toHaveBeenCalled();
  });

  it("includes YuragiStyles by default", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(async () => outline),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    render(
      <YuragiFontProvider font={font}>
        <span>Runtime child</span>
      </YuragiFontProvider>,
    );

    expect(document.querySelector("style[data-yuragi-style]")).not.toBeNull();
    expect(screen.getByText("Runtime child")).not.toBeNull();
  });

  it("can disable provider styles when CSS is imported manually", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(async () => outline),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    render(
      <YuragiFontProvider font={font} includeStyles={false}>
        <span>Runtime child</span>
      </YuragiFontProvider>,
    );

    expect(document.querySelector("style[data-yuragi-style]")).toBeNull();
    expect(screen.getByText("Runtime child")).not.toBeNull();
  });

  it("passes styleNonce to provider styles", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(async () => outline),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    render(
      <YuragiFontProvider font={font} styleNonce="nonce-123">
        <span>Runtime child</span>
      </YuragiFontProvider>,
    );

    const style = document.querySelector("style[data-yuragi-style]");
    expect(style?.getAttribute("nonce")).toBe("nonce-123");
  });

  it("throws when YuragiText is rendered without a YuragiFontProvider", () => {
    expect(() => render(<YuragiText text="Missing Provider" />)).toThrow(
      "YuragiText from @yuragi/react requires YuragiFontProvider",
    );
  });
});
