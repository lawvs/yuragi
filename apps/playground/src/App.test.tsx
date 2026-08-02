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
  onExitComplete: undefined as (() => void) | undefined,
}));
const runtimeProviderMocks = vi.hoisted(() => ({
  mountCount: 0,
  unmountCount: 0,
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

vi.mock("@yuragi-labs/react", async () => {
  const { useEffect } = await vi.importActual<typeof import("react")>("react");

  return {
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
      includeStyles,
      preload,
      wasm,
    }: {
      axes?: FontAxes;
      children: ReactNode;
      font: string;
      includeStyles?: boolean;
      preload?: readonly string[];
      wasm?: string;
    }) => {
      useEffect(() => {
        runtimeProviderMocks.mountCount += 1;
        return () => {
          runtimeProviderMocks.unmountCount += 1;
        };
      }, []);

      return (
        <div
          data-yuragi-runtime-provider=""
          data-font={font}
          data-wasm={wasm}
          data-axes={axes ? JSON.stringify(axes) : undefined}
          data-include-styles={includeStyles?.toString()}
          data-preload={preload ? JSON.stringify(preload) : undefined}
        >
          {children}
        </div>
      );
    },
    YuragiText: ({
      animation,
      fallback,
      text,
    }: {
      animation?: { enter?: boolean; exit?: boolean; speed?: number };
      fallback?: string | { delayMs: number };
      text: string;
    }) => {
      return (
        <span
          data-animation-exit={animation?.exit?.toString()}
          data-animation-speed={animation?.speed}
          data-fallback={
            typeof fallback === "string" ? fallback : undefined
          }
          data-fallback-delay={
            typeof fallback === "object" ? fallback.delayMs : undefined
          }
          data-runtime-sharded-text={text}
          data-sharded-text={text}
        >
          {text}
        </span>
      );
    },
  };
});

vi.mock("@yuragi-labs/react/static", async () => {
  const { useEffect } = await vi.importActual<typeof import("react")>("react");

  return {
    YuragiText: ({
      className,
      text,
      animation,
      fallback,
      hover,
      outline,
      onEnterComplete,
      onExitComplete,
    }: {
      className?: string;
      text: string;
      animation?: { enter?: boolean; exit?: boolean; speed?: number };
      fallback?: string;
      hover?: string;
      outline?: unknown;
      onEnterComplete?: () => void;
      onExitComplete?: () => void;
    }) => {
      useEffect(() => {
        staticYuragiMocks.mountCount += 1;
      }, []);
      staticYuragiMocks.onEnterComplete = onEnterComplete;
      staticYuragiMocks.onExitComplete = onExitComplete;

      return (
        <span
          className={className}
          data-animation-exit={animation?.exit?.toString()}
          data-animation-speed={animation?.speed}
          data-fallback={fallback}
          data-has-outline={outline ? "true" : "false"}
          data-hover={hover}
          data-static-sharded-text={text}
          data-sharded-text={text}
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
    staticYuragiMocks.onExitComplete = undefined;
    runtimeProviderMocks.mountCount = 0;
    runtimeProviderMocks.unmountCount = 0;
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
    expect(title?.getAttribute("data-animation-speed")).toBe("1.4");
    expect(
      hero?.querySelector('a[href="#playground"]')?.textContent,
    ).toContain("Playground");
    expect(host.querySelector("section#playground")).not.toBeNull();
  });

  it("remounts the wordmark to replay enter without playing exit", () => {
    renderApp();

    expect(host.querySelector(".hero-replay")).toBeNull();
    expect(staticYuragiMocks.mountCount).toBe(1);

    act(() => staticYuragiMocks.onEnterComplete?.());

    const replay = host.querySelector<HTMLButtonElement>(".hero-replay");
    expect(replay?.textContent).toContain("Replay");

    act(() => replay?.click());

    expect(host.querySelector(".hero-replay")).toBeNull();
    expect(staticYuragiMocks.mountCount).toBe(2);
    const remounted = host.querySelector(
      '[data-static-sharded-text="yuragi"]',
    );
    expect(remounted).not.toBeNull();
    expect(remounted?.getAttribute("data-animation-exit")).toBe("false");
    expect(staticYuragiMocks.onExitComplete).toBeUndefined();

    act(() => staticYuragiMocks.onEnterComplete?.());

    expect(host.querySelector(".hero-replay")).not.toBeNull();
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

    expect(tabLabels).toEqual([
      "Demo",
      "Shard Inspector",
      "WASM Lab",
      "Morph Lab",
    ]);
    expect(runtimeTab?.getAttribute("aria-pressed")).toBe("true");
    expect(provider?.getAttribute("data-font")).toContain(
      "SourceHanSerifSC-VF.otf",
    );
    expect(provider?.getAttribute("data-wasm")).toEqual(
      expect.stringContaining("yuragi_wasm_compiler.wasm"),
    );
    expect(provider?.getAttribute("data-axes")).toBe('{"wght":900}');
    expect(provider?.getAttribute("data-preload")).toBe(
      '["Dashboard","Settings"]',
    );
    expect(dashboard).not.toBeNull();
    expect(host.querySelector(".font-status")?.textContent).toBe("Font ready");
    expect(
      host.querySelector(".preview-title [data-static-sharded-text]"),
    ).toBeNull();
    expect(host.textContent).not.toContain("Missing Outline");
  });

  it("only enables tab exit animation for the demo preview", () => {
    renderApp();

    const listTitle = host.querySelector(
      '.post-title [data-runtime-sharded-text="Dashboard"]',
    );
    const previewTitle = host.querySelector(
      '.preview-title [data-runtime-sharded-text="Dashboard"]',
    );

    expect(listTitle?.getAttribute("data-animation-exit")).toBe("false");
    expect(previewTitle?.getAttribute("data-animation-exit")).toBe("true");

    act(() => {
      host
        .querySelector<HTMLButtonElement>('button[data-view="wasm-lab"]')
        ?.click();
    });

    const wasmPreview = host.querySelector(
      '.wasm-lab-preview [data-static-sharded-text]',
    );
    expect(wasmPreview?.getAttribute("data-animation-exit")).toBe("false");
  });

  it("uses the default fallback behavior for demo titles", () => {
    renderApp();

    const listTitle = host.querySelector(
      '.post-title [data-runtime-sharded-text="Dashboard"]',
    );
    const previewTitle = host.querySelector(
      '.preview-title [data-runtime-sharded-text="Dashboard"]',
    );

    expect(listTitle?.hasAttribute("data-fallback")).toBe(false);
    expect(previewTitle?.hasAttribute("data-fallback")).toBe(false);
    expect(listTitle?.hasAttribute("data-fallback-delay")).toBe(false);
    expect(previewTitle?.hasAttribute("data-fallback-delay")).toBe(false);
  });

  it("keeps the runtime font provider mounted across tab switches", () => {
    renderApp();

    expect(runtimeProviderMocks.mountCount).toBe(1);
    expect(runtimeProviderMocks.unmountCount).toBe(0);

    act(() => {
      host
        .querySelector<HTMLButtonElement>('button[data-view="shard-inspector"]')
        ?.click();
    });
    act(() => {
      host
        .querySelector<HTMLButtonElement>('button[data-view="runtime-demo"]')
        ?.click();
    });

    expect(runtimeProviderMocks.mountCount).toBe(1);
    expect(runtimeProviderMocks.unmountCount).toBe(0);
    expect(
      host
        .querySelector("[data-yuragi-runtime-provider]")
        ?.getAttribute("data-include-styles"),
    ).toBe("false");
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

  it("opens a detail view with controls and animation speed settings", () => {
    renderApp();

    const settingsButton = host.querySelector<HTMLButtonElement>(
      'button[data-post-id="settings"]',
    );
    expect(settingsButton).not.toBeNull();

    act(() => {
      settingsButton?.click();
    });

    expect(host.querySelector('input[type="range"]')).not.toBeNull();
    expect(host.querySelector('input[name="animation-speed"]')).not.toBeNull();
    expect(host.querySelector('select[name="align"]')).not.toBeNull();
    expect(host.querySelector('input[name="hover"]')).not.toBeNull();

    const title = host.querySelector(
      '.preview-title [data-sharded-text="Settings"]',
    );
    expect(title?.getAttribute("data-animation-speed")).toBe("1");
    expect(reactMocks.startTransition).toHaveBeenCalledTimes(1);
  });

  it("keeps the WASM lab behind an explicit playground tab with guided steps", () => {
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
    expect(host.textContent).toContain("1. Load compiler and font");
    expect(host.textContent).toContain("Compile title");
    expect(host.textContent).toContain(
      "Load the compiler and selected font before compiling.",
    );
    expect(host.textContent).toContain(
      "Compile is available after the compiler and font are loaded.",
    );
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
