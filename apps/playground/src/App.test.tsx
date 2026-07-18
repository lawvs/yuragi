import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { FontAxes } from "@yuragi-labs/core";

const reactMocks = vi.hoisted(() => ({
  startTransition: vi.fn((callback: () => void) => callback()),
}));
const staticYuragiMocks = vi.hoisted(() => ({
  mountCount: 0,
  onEnterComplete: undefined as (() => void) | undefined,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    startTransition: reactMocks.startTransition,
  };
});

vi.mock("@yuragi-labs/react", () => ({
  useYuragiFont: () => ({
    status: "ready",
    ready: true,
    font: {},
    error: null,
  }),
  YuragiFontProvider: ({
    axes,
    children,
    font,
    wasm,
  }: {
    axes?: FontAxes;
    children: ReactNode;
    font: string;
    wasm?: string;
  }) => (
    <div
      data-yuragi-runtime-provider=""
      data-font={font}
      data-wasm={wasm}
      data-axes={axes ? JSON.stringify(axes) : undefined}
    >
      {children}
    </div>
  ),
  YuragiText: ({
    fallback,
    text,
    transition,
  }: {
    fallback?: string;
    text: string;
    transition?: {
      enter?: string;
      exit?: string;
      speed?: number;
    };
  }) => (
    <span
      data-fallback={fallback}
      data-runtime-sharded-text={text}
      data-sharded-text={text}
      data-transition-enter={transition?.enter}
      data-transition-exit={transition?.exit}
      data-transition-speed={transition?.speed}
    >
      {text}
    </span>
  ),
}));

vi.mock("@yuragi-labs/react/static", async () => {
  const { useEffect } = await vi.importActual<typeof import("react")>("react");

  return {
    YuragiText: ({
      className,
      text,
      fallback,
      hover,
      outline,
      transition,
      onEnterComplete,
    }: {
      className?: string;
      text: string;
      fallback?: string;
      hover?: string;
      outline?: unknown;
      transition?: {
        enter?: string;
        exit?: string;
        speed?: number;
      };
      onEnterComplete?: () => void;
    }) => {
      useEffect(() => {
        staticYuragiMocks.mountCount += 1;
      }, []);
      staticYuragiMocks.onEnterComplete = onEnterComplete;

      return (
        <span
          className={className}
          data-fallback={fallback}
          data-has-outline={outline ? "true" : "false"}
          data-hover={hover}
          data-static-sharded-text={text}
          data-sharded-text={text}
          data-transition-enter={transition?.enter}
          data-transition-exit={transition?.exit}
          data-transition-speed={transition?.speed}
        >
          {text}
        </span>
      );
    },
  };
});

describe("App", () => {
  let host: HTMLDivElement;

  afterEach(() => {
    host.remove();
    reactMocks.startTransition.mockClear();
    staticYuragiMocks.mountCount = 0;
    staticYuragiMocks.onEnterComplete = undefined;
  });

  function renderApp() {
    host = document.createElement("div");
    document.body.append(host);
    act(() => {
      createRoot(host).render(<App />);
    });
  }

  function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("renders a self-hosted Yuragi hero from a static outline", () => {
    renderApp();

    const hero = host.querySelector(".hero");
    const title = hero?.querySelector(
      'h1 [data-static-sharded-text="yuragi"]',
    );

    expect(title?.getAttribute("data-has-outline")).toBe("true");
    expect(title?.getAttribute("data-fallback")).toBe("error");
    expect(title?.getAttribute("data-hover")).toBe("outline");
    expect(title?.getAttribute("data-transition-enter")).toBe("settle");
    expect(
      hero?.querySelector('a[href="#playground"]')?.textContent,
    ).toContain("Playground");
    expect(host.querySelector("section#playground")).not.toBeNull();
  });

  it("reveals Replay after enter completes and remounts the wordmark", () => {
    renderApp();

    expect(host.querySelector(".hero-replay")).toBeNull();
    expect(staticYuragiMocks.mountCount).toBe(1);

    act(() => staticYuragiMocks.onEnterComplete?.());

    const replay = host.querySelector<HTMLButtonElement>(".hero-replay");
    expect(replay?.textContent).toContain("Replay");

    act(() => replay?.click());

    expect(host.querySelector(".hero-replay")).toBeNull();
    expect(staticYuragiMocks.mountCount).toBe(2);
  });

  it("renders the default demo as the first playground tab through the public React API", () => {
    renderApp();

    const tabLabels = Array.from(
      host.querySelectorAll<HTMLButtonElement>(".view-tabs button"),
      (button) => button.textContent,
    );
    const runtimeTab = host.querySelector<HTMLButtonElement>(
      'button[data-view="runtime-demo"]',
    );
    const provider = host.querySelector("[data-yuragi-runtime-provider]");
    const dashboard = host.querySelector(
      '.preview-title [data-runtime-sharded-text="Dashboard"]',
    );

    expect(tabLabels).toEqual(["Demo", "Shard Inspector", "WASM Lab"]);
    expect(runtimeTab?.getAttribute("aria-pressed")).toBe("true");
    expect(provider?.getAttribute("data-font")).toContain(
      "SourceHanSerifSC-VF.otf",
    );
    expect(provider?.getAttribute("data-wasm")).toEqual(
      expect.stringContaining("yuragi_wasm_compiler.wasm"),
    );
    expect(provider?.getAttribute("data-axes")).toBe('{"wght":900}');
    expect(dashboard).not.toBeNull();
    expect(host.querySelector(".font-status")?.textContent).toBe("Font ready");
    expect(
      host.querySelector(".preview-title [data-static-sharded-text]"),
    ).toBeNull();
    expect(host.textContent).not.toContain("Missing Outline");
  });

  it("updates the demo preview title from text input", () => {
    renderApp();

    const titleInput = host.querySelector<HTMLInputElement>(
      'input[name="runtime-title"]',
    );
    expect(titleInput).not.toBeNull();

    act(() => {
      setInputValue(titleInput!, "Live Demo Title");
    });

    const title = host.querySelector(
      '.preview-title [data-runtime-sharded-text="Live Demo Title"]',
    );
    expect(title).not.toBeNull();
  });

  it("opens a detail view with controls and enter/exit shard animation settings", () => {
    renderApp();

    const settingsButton = host.querySelector<HTMLButtonElement>(
      'button[data-post-id="settings"]',
    );
    expect(settingsButton).not.toBeNull();

    act(() => {
      settingsButton?.click();
    });

    expect(host.querySelector('input[type="range"]')).not.toBeNull();
    expect(host.querySelector('input[name="transition-speed"]')).not.toBeNull();
    expect(host.querySelector('select[name="align"]')).not.toBeNull();
    expect(host.querySelector('input[name="hover"]')).not.toBeNull();

    const title = host.querySelector(
      '.preview-title [data-sharded-text="Settings"]',
    );
    expect(title?.getAttribute("data-transition-enter")).toBe("settle");
    expect(title?.getAttribute("data-transition-exit")).toBe("scatter");
    expect(title?.getAttribute("data-transition-speed")).toBe("1");
    expect(reactMocks.startTransition).toHaveBeenCalledTimes(1);
  });

  it("keeps the experimental WASM lab behind an explicit playground tab", () => {
    renderApp();

    expect(host.querySelector("[data-yuragi-runtime-provider]")).not.toBeNull();
    expect(host.querySelector(".wasm-lab")).toBeNull();

    const labTab = host.querySelector<HTMLButtonElement>(
      'button[data-view="wasm-lab"]',
    );
    expect(labTab).not.toBeNull();

    act(() => {
      labTab?.click();
    });

    expect(host.querySelector(".workspace")).toBeNull();
    expect(host.querySelector(".wasm-lab")).not.toBeNull();
    expect(host.textContent).toContain("WASM Lab");
    expect(host.textContent).toContain("Compile title");
  });

  it("opens the Shard Inspector with multilingual glyph sections and search", () => {
    renderApp();

    act(() => {
      host
        .querySelector<HTMLButtonElement>('button[data-view="shard-inspector"]')
        ?.click();
    });

    expect(host.querySelector(".shard-inspector")).not.toBeNull();
    expect(host.textContent).toContain("Latin");
    expect(host.textContent).toContain("Common Chinese");
    expect(host.textContent).toContain("Hiragana");
    expect(host.textContent).toContain("Katakana");

    const search = host.querySelector<HTMLInputElement>(
      'input[name="glyph-search"]',
    );
    expect(search).not.toBeNull();

    act(() => {
      setInputValue(search!, "舞");
      host
        .querySelector<HTMLButtonElement>('button[data-action="add-glyphs"]')
        ?.click();
    });

    expect(host.querySelector('[data-glyph="舞"]')).not.toBeNull();
    expect(host.textContent).toContain("Search Results");
  });
});
