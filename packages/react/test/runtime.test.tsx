import {
  act,
  cleanup,
  render,
  screen,
} from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useYuragiFont,
  YuragiFontProvider,
  YuragiText,
} from "../src/index";
import { createYuragiFont } from "@yuragi-labs/core/wasm";
import type { YuragiFont } from "@yuragi-labs/core/wasm";
import type { TextOutline } from "@yuragi-labs/core";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

vi.mock("@yuragi-labs/core/wasm", () => ({
  createYuragiFont: vi.fn(),
}));

vi.mock("../src/YuragiText", () => ({
  YuragiText: ({
    text,
    outline,
    fallback,
    animation,
  }: {
    text: string;
    outline?: TextOutline;
    fallback?: string;
    animation?: boolean | {
      enter?: boolean;
      exit?: boolean;
      speed?: number;
    };
  }) => {
    const options = typeof animation === "object" ? animation : undefined;
    return (
      <span
        data-animation={
          typeof animation === "boolean" ? String(animation) : undefined
        }
        data-animation-enter={options?.enter?.toString()}
        data-animation-exit={options?.exit?.toString()}
        data-animation-speed={options?.speed}
        data-fallback={fallback}
        data-has-outline={outline ? "yes" : "no"}
        data-sharded-text={text}
      >
        {text}
      </span>
    );
  },
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

describe("@yuragi-labs/react runtime", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.mocked(createYuragiFont).mockReset();
  });

  it("loads a font provider and resolves outlines for YuragiText", async () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };
    vi.mocked(createYuragiFont).mockResolvedValue(font);

    render(
      <YuragiFontProvider
        font={new Uint8Array([1, 2, 3])}
        axes={{ wght: 900 }}
        preload={["复杂分层"]}
      >
        <YuragiText text="复杂分层" fallback="text" />
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

    cleanup();
    expect(font.dispose).toHaveBeenCalled();
  });

  it("renders an outline in the first commit when the font is ready", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };
    let firstCommitHasOutline: string | undefined;

    function FirstCommitProbe() {
      useLayoutEffect(() => {
        firstCommitHasOutline =
          screen.getByText("Runtime").dataset.hasOutline;
      }, []);

      return <YuragiText text="Runtime" fallback="hidden" />;
    }

    render(
      <YuragiFontProvider font={font}>
        <FirstCommitProbe />
      </YuragiFontProvider>,
    );

    expect(firstCommitHasOutline).toBe("yes");
    expect(font.compile).toHaveBeenCalledWith("Runtime");
  });

  it("exposes loading and ready font state through useYuragiFont", async () => {
    const loaded = deferred<YuragiFont>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
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

  it("does not animate enter for the first runtime outline reveal", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };

    render(
      <YuragiFontProvider font={font}>
        <YuragiText
          text="Runtime"
          animation={{ speed: 0.8 }}
        />
      </YuragiFontProvider>,
    );

    const rendered = screen.getByText("Runtime");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.animationEnter).toBe("false");
    expect(rendered.dataset.animationExit).toBeUndefined();
    expect(rendered.dataset.animationSpeed).toBe("0.8");
  });

  it("delays the text fallback while the font is loading", () => {
    vi.useFakeTimers();
    const loaded = deferred<YuragiFont>();
    vi.mocked(createYuragiFont).mockReturnValue(loaded.promise);

    render(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <YuragiText
          text="Runtime"
          fallback={{ delayMs: 150 }}
        />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("Runtime").dataset.fallback).toBe("hidden");

    act(() => vi.advanceTimersByTime(149));
    expect(screen.getByText("Runtime").dataset.fallback).toBe("hidden");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Runtime").dataset.fallback).toBe("text");
  });

  it("does not animate after a delayed fallback becomes visible", async () => {
    vi.useFakeTimers();
    const loaded = deferred<YuragiFont>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };
    vi.mocked(createYuragiFont).mockReturnValue(loaded.promise);

    render(
      <YuragiFontProvider
        font={new Uint8Array([1, 2, 3])}
        preload={["Runtime"]}
      >
        <YuragiText
          text="Runtime"
          fallback={{ delayMs: 150 }}
          animation={{ speed: 0.8 }}
        />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("Runtime").dataset.fallback).toBe("hidden");

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByText("Runtime").dataset.fallback).toBe("text");

    await act(async () => {
      loaded.resolve(font);
      await loaded.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    const rendered = screen.getByText("Runtime");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.animationEnter).toBe("false");
    expect(rendered.dataset.animationSpeed).toBe("0.8");
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid fallback delay %s",
    (delayMs) => {
      const font = {
        info: { bytes: 3, unitsPerEm: 1000 },
        compile: vi.fn(() => outline),
        preload: vi.fn(() => undefined),
        dispose: vi.fn(),
      };

      expect(() =>
        render(
          <YuragiFontProvider font={font}>
            <YuragiText
              text="Runtime"
              fallback={{ delayMs }}
            />
          </YuragiFontProvider>,
        ),
      ).toThrow("fallback.delayMs must be finite and non-negative");
    },
  );

  it("treats a zero fallback delay as immediate text", () => {
    const loaded = deferred<YuragiFont>();
    vi.mocked(createYuragiFont).mockReturnValue(loaded.promise);

    render(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <YuragiText
          text="Runtime"
          fallback={{ delayMs: 0 }}
        />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("Runtime").dataset.fallback).toBe("text");
  });

  it("restarts the fallback delay when text changes", () => {
    vi.useFakeTimers();
    const loaded = deferred<YuragiFont>();
    vi.mocked(createYuragiFont).mockReturnValue(loaded.promise);
    const { rerender } = render(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <YuragiText
          text="First"
          fallback={{ delayMs: 150 }}
        />
      </YuragiFontProvider>,
    );

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByText("First").dataset.fallback).toBe("text");

    rerender(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <YuragiText
          text="Second"
          fallback={{ delayMs: 150 }}
        />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("Second").dataset.fallback).toBe("hidden");
  });

  it("keeps the default enter animation for later runtime text changes", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };

    const { rerender } = render(
      <YuragiFontProvider font={font}>
        <YuragiText text="First" />
      </YuragiFontProvider>,
    );

    expect(screen.getByText("First").dataset.animationEnter).toBe("false");

    rerender(
      <YuragiFontProvider font={font}>
        <YuragiText text="Second" />
      </YuragiFontProvider>,
    );

    const rendered = screen.getByText("Second");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.animationEnter).toBeUndefined();
  });

  it("does not animate enter when text changes before the font is ready", async () => {
    const loaded = deferred<YuragiFont>();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };
    vi.mocked(createYuragiFont).mockReturnValue(loaded.promise);

    const { rerender } = render(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <YuragiText text="First" />
      </YuragiFontProvider>,
    );

    rerender(
      <YuragiFontProvider font={new Uint8Array([1, 2, 3])}>
        <YuragiText text="Second" />
      </YuragiFontProvider>,
    );

    await act(async () => {
      loaded.resolve(font);
      await loaded.promise;
    });

    const rendered = screen.getByText("Second");
    expect(rendered.dataset.hasOutline).toBe("yes");
    expect(rendered.dataset.animationEnter).toBe("false");
  });

  it("configures provider-managed styles", () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(() => outline),
      preload: vi.fn(() => undefined),
      dispose: vi.fn(),
    };

    const { rerender } = render(
      <YuragiFontProvider font={font}>
        <span>Runtime child</span>
      </YuragiFontProvider>,
    );

    expect(document.querySelector("style[data-yuragi-style]")).not.toBeNull();
    expect(screen.getByText("Runtime child")).not.toBeNull();

    rerender(
      <YuragiFontProvider font={font} includeStyles={false}>
        <span>Runtime child</span>
      </YuragiFontProvider>,
    );

    expect(document.querySelector("style[data-yuragi-style]")).toBeNull();

    rerender(
      <YuragiFontProvider font={font} styleNonce="nonce-123">
        <span>Runtime child</span>
      </YuragiFontProvider>,
    );

    const style = document.querySelector("style[data-yuragi-style]");
    expect(style?.getAttribute("nonce")).toBe("nonce-123");
  });

  it("throws when YuragiText is rendered without a YuragiFontProvider", () => {
    expect(() => render(<YuragiText text="Missing Provider" />)).toThrow(
      "useYuragiFont from @yuragi-labs/react requires YuragiFontProvider",
    );
  });
});
