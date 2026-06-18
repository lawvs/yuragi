import React from "react";
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
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    startTransition: reactMocks.startTransition,
  };
});

vi.mock("@type-shards/react", () => ({
  ShardedText: ({
    text,
    sharedId,
    fallback,
    transition,
  }: {
    text: string;
    sharedId?: string;
    fallback?: string;
    transition?: {
      enter?: string;
      exit?: string;
      enterDuration?: number;
      exitDuration?: number;
    };
  }) => (
    <span
      data-fallback={fallback}
      data-sharded-text={text}
      data-shared-id={sharedId}
      data-transition-enter={transition?.enter}
      data-transition-exit={transition?.exit}
      data-transition-enter-duration={transition?.enterDuration}
      data-transition-exit-duration={transition?.exitDuration}
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

  it("renders selectable demo posts with shared title ids and fallback support", () => {
    renderApp();

    const dashboard = host.querySelector('[data-sharded-text="Dashboard"]');
    const missing = host.querySelector('[data-sharded-text="Missing Outline"]');

    expect(dashboard?.getAttribute("data-shared-id")).toBe("title:dashboard");
    expect(missing?.getAttribute("data-shared-id")).toBe("title:missing");
    expect(missing?.getAttribute("data-fallback")).toBe("text");
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
    expect(host.querySelector('input[name="enter-duration"]')).not.toBeNull();
    expect(host.querySelector('input[name="exit-duration"]')).not.toBeNull();
    expect(host.querySelector('select[name="align"]')).not.toBeNull();
    expect(host.querySelector('input[name="hover"]')).not.toBeNull();

    const title = host.querySelector(
      '.preview-title [data-sharded-text="Settings"]',
    );
    expect(title?.getAttribute("data-shared-id")).toBe("title:settings");
    expect(title?.getAttribute("data-transition-enter")).toBe("settle");
    expect(title?.getAttribute("data-transition-exit")).toBe("scatter");
    expect(title?.getAttribute("data-transition-enter-duration")).toBe("500");
    expect(title?.getAttribute("data-transition-exit-duration")).toBe("420");
    expect(reactMocks.startTransition).toHaveBeenCalledTimes(1);
  });

  it("updates enter and exit durations from the playground controls", () => {
    renderApp();

    const enterDuration = host.querySelector<HTMLInputElement>(
      'input[name="enter-duration"]',
    );
    const exitDuration = host.querySelector<HTMLInputElement>(
      'input[name="exit-duration"]',
    );
    expect(enterDuration).not.toBeNull();
    expect(exitDuration).not.toBeNull();

    act(() => {
      setInputValue(enterDuration!, "640");
      setInputValue(exitDuration!, "560");
    });

    const title = host.querySelector(
      '.preview-title [data-sharded-text="Dashboard"]',
    );
    expect(title?.getAttribute("data-transition-enter-duration")).toBe("640");
    expect(title?.getAttribute("data-transition-exit-duration")).toBe("560");
  });

  it("constrains list shard SVG width for mobile cards", () => {
    const styles = readFileSync(
      join(testDir, "styles.css"),
      "utf8",
    );

    expect(styles).toMatch(
      /\.post-title\s+\[data-type-shards-root\]\s*{[^}]*width:\s*min\(100%,\s*300px\)/s,
    );
    expect(styles).toMatch(/width:\s*min\(calc\(100vw - 24px\),\s*720px\)/);
    expect(styles).toMatch(/width:\s*min\(calc\(100vw - 24px\),\s*366px\)/);
    expect(styles).toMatch(
      /\.range-control\s*{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/s,
    );
  });
});
