import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useYuragiFont,
  YuragiFontProvider,
  YuragiText,
} from "../src/index";
import { createYuragiFont } from "@yuragi/wasm";
import type { YuragiFont } from "@yuragi/wasm";
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
    transition,
  }: {
    text: string;
    outline?: TextOutline;
    fallback?: string;
    sharedId?: string | false;
    transition?: {
      enter?: string;
      exit?: string;
      speed?: number;
    };
  }) => (
    <span
      data-fallback={fallback}
      data-has-outline={outline ? "yes" : "no"}
      data-sharded-text={text}
      data-shared-id={sharedId || undefined}
      data-transition-enter={transition?.enter}
      data-transition-exit={transition?.exit}
      data-transition-speed={transition?.speed}
    >
      {text}
    </span>
  ),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function FontStateProbe() {
  const state = useYuragiFont();

  return (
    <span
      data-error={state.error?.message}
      data-has-font={state.font ? "yes" : "no"}
      data-ready={String(state.ready)}
      data-status={state.status}
    >
      font state
    </span>
  );
}

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

  it("exposes loading and ready font state through useYuragiFont", async () => {
    const loaded = deferred<YuragiFont>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(async () => outline),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    vi.mocked(createYuragiFont).mockReturnValue(loaded.promise);

    render(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <FontStateProbe />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("font state").dataset.status).toBe("loading");
    expect(screen.getByText("font state").dataset.ready).toBe("false");
    expect(screen.getByText("font state").dataset.hasFont).toBe("no");

    await act(async () => {
      loaded.resolve(font);
      await loaded.promise;
    });

    expect(screen.getByText("font state").dataset.status).toBe("ready");
    expect(screen.getByText("font state").dataset.ready).toBe("true");
    expect(screen.getByText("font state").dataset.hasFont).toBe("yes");
  });

  it("exposes font loading errors through useYuragiFont", async () => {
    vi.mocked(createYuragiFont).mockRejectedValue(
      new Error("font failed"),
    );

    render(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <FontStateProbe />
      </YuragiFontProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("font state").dataset.status).toBe("error");
    expect(screen.getByText("font state").dataset.ready).toBe("false");
    expect(screen.getByText("font state").dataset.hasFont).toBe("no");
    expect(screen.getByText("font state").dataset.error).toBe(
      "font failed",
    );
  });

  it("does not use enter transition for the first runtime outline reveal", async () => {
    const compiled = deferred<TextOutline>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => compiled.promise),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    render(
      <YuragiFontProvider font={font}>
        <YuragiText
          text="Runtime"
          transition={{ enter: "settle", exit: "scatter", speed: 0.8 }}
        />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("Runtime").dataset.hasOutline).toBe("no");

    await act(async () => {
      compiled.resolve(outline);
      await compiled.promise;
    });

    const rendered = screen.getByText("Runtime");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.transitionEnter).toBe("none");
    expect(rendered.dataset.transitionExit).toBe("scatter");
    expect(rendered.dataset.transitionSpeed).toBe("0.8");
  });

  it("keeps enter transition for runtime text changes after the first outline", async () => {
    const first = deferred<TextOutline>();
    const second = deferred<TextOutline>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn((text: string) =>
        text === "First" ? first.promise : second.promise,
      ),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const { rerender } = render(
      <YuragiFontProvider font={font}>
        <YuragiText text="First" transition={{ enter: "settle" }} />
      </YuragiFontProvider>,
    );

    await act(async () => {
      first.resolve(outline);
      await first.promise;
    });

    expect(screen.getByText("First").dataset.transitionEnter).toBe("none");

    rerender(
      <YuragiFontProvider font={font}>
        <YuragiText text="Second" transition={{ enter: "settle" }} />
      </YuragiFontProvider>,
    );

    await act(async () => {
      second.resolve(outline);
      await second.promise;
    });

    const rendered = screen.getByText("Second");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.transitionEnter).toBe("settle");
  });

  it("does not use enter transition when text changes before the first runtime outline reveal", async () => {
    const first = deferred<TextOutline>();
    const second = deferred<TextOutline>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn((text: string) =>
        text === "First" ? first.promise : second.promise,
      ),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const { rerender } = render(
      <YuragiFontProvider font={font}>
        <YuragiText text="First" transition={{ enter: "settle" }} />
      </YuragiFontProvider>,
    );

    rerender(
      <YuragiFontProvider font={font}>
        <YuragiText text="Second" transition={{ enter: "settle" }} />
      </YuragiFontProvider>,
    );

    await act(async () => {
      first.resolve(outline);
      second.resolve(outline);
      await Promise.all([first.promise, second.promise]);
    });

    const rendered = screen.getByText("Second");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.transitionEnter).toBe("none");
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
      "useYuragiFont from @yuragi/react requires YuragiFontProvider",
    );
  });
});
