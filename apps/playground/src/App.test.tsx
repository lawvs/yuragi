import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const testDir = dirname(fileURLToPath(import.meta.url));
const reactMocks = vi.hoisted(() => ({
  startTransition: vi.fn((callback: () => void) => callback()),
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

vi.mock("@yuragi/react", () => ({
  YuragiText: ({
    text,
    sharedId,
    fallback,
    transition,
  }: {
    text: string;
    sharedId?: string | false;
    fallback?: string;
    transition?: {
      enter?: string;
      exit?: string;
      speed?: number;
    };
  }) => (
    <span
      data-fallback={fallback}
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

describe("App", () => {
  let host: HTMLDivElement;

  afterEach(() => {
    host.remove();
    reactMocks.startTransition.mockClear();
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

  function setSelectValue(select: HTMLSelectElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("renders selectable demo posts with shared title ids and fallback support", () => {
    renderApp();

    const dashboard = host.querySelector(
      '.preview-title [data-sharded-text="Dashboard"]',
    );
    const missing = host.querySelector('[data-sharded-text="Missing Outline"]');

    expect(dashboard?.getAttribute("data-shared-id")).toBe("title:dashboard");
    expect(missing?.getAttribute("data-shared-id")).toBe("title:missing");
    expect(missing?.getAttribute("data-fallback")).toBe("text");
  });

  it("does not mount duplicate shared title ids in the demo view", () => {
    renderApp();

    const sharedIds = Array.from(host.querySelectorAll("[data-shared-id]"))
      .map((node) => node.getAttribute("data-shared-id"))
      .filter((value): value is string => Boolean(value));

    expect(sharedIds).toEqual(Array.from(new Set(sharedIds)));

    act(() => {
      host
        .querySelector<HTMLButtonElement>('button[data-post-id="settings"]')
        ?.click();
    });

    const nextSharedIds = Array.from(host.querySelectorAll("[data-shared-id]"))
      .map((node) => node.getAttribute("data-shared-id"))
      .filter((value): value is string => Boolean(value));

    expect(nextSharedIds).toEqual(Array.from(new Set(nextSharedIds)));
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
    expect(title?.getAttribute("data-shared-id")).toBe("title:settings");
    expect(title?.getAttribute("data-transition-enter")).toBe("settle");
    expect(title?.getAttribute("data-transition-exit")).toBe("scatter");
    expect(title?.getAttribute("data-transition-speed")).toBe("1");
    expect(reactMocks.startTransition).toHaveBeenCalledTimes(1);
  });

  it("updates transition speed from the playground control", () => {
    renderApp();

    const transitionSpeed = host.querySelector<HTMLInputElement>(
      'input[name="transition-speed"]',
    );
    expect(transitionSpeed).not.toBeNull();

    act(() => {
      setInputValue(transitionSpeed!, "0.8");
    });

    const title = host.querySelector(
      '.preview-title [data-sharded-text="Dashboard"]',
    );
    expect(title?.getAttribute("data-transition-speed")).toBe("0.8");
  });

  it("can disable shared title motion from the demo controls", () => {
    renderApp();

    expect(host.querySelector("[data-shared-id]")).not.toBeNull();

    const sharedTitleMotion = host.querySelector<HTMLInputElement>(
      'input[name="shared-title-motion"]',
    );
    expect(sharedTitleMotion).not.toBeNull();

    act(() => {
      sharedTitleMotion?.click();
    });

    expect(host.querySelector("[data-shared-id]")).toBeNull();
  });

  it("keeps the experimental WASM lab behind an explicit playground tab", () => {
    renderApp();

    expect(host.querySelector(".workspace")).not.toBeNull();
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

  it("switches WASM Lab font presets with matching sample text and URL", () => {
    renderApp();

    act(() => {
      host.querySelector<HTMLButtonElement>('button[data-view="wasm-lab"]')?.click();
    });

    const preset = host.querySelector<HTMLSelectElement>(
      'select[name="wasm-font-preset"]',
    );
    const title = host.querySelector<HTMLInputElement>('input[name="wasm-title"]');
    const url = host.querySelector<HTMLInputElement>('input[name="wasm-font-url"]');

    expect(preset).not.toBeNull();
    expect(title?.value).toBe("复杂分层");
    expect(url?.value).toContain("SourceHanSerifSC-VF.otf");

    act(() => {
      setSelectValue(preset!, "inter");
    });

    expect(title?.value).toBe("Dashboard");
    expect(url?.value).toContain("Inter%5Bopsz,wght%5D.ttf");
  });

  it("constrains list shard SVG width for mobile cards", () => {
    const styles = readFileSync(
      join(testDir, "styles.css"),
      "utf8",
    );

    expect(styles).toMatch(
      /\.post-title\s+\[data-yuragi-root\]\s*{[^}]*width:\s*min\(100%,\s*300px\)/s,
    );
    expect(styles).toMatch(/width:\s*min\(calc\(100vw - 24px\),\s*720px\)/);
    expect(styles).toMatch(/width:\s*min\(calc\(100vw - 24px\),\s*366px\)/);
    expect(styles).toMatch(
      /\.range-control\s*{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/s,
    );
  });
});
