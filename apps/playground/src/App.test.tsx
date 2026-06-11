import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const testDir = dirname(fileURLToPath(import.meta.url));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
    transition?: { enter?: string; exit?: string };
  }) => (
    <span
      data-fallback={fallback}
      data-sharded-text={text}
      data-shared-id={sharedId}
      data-transition-enter={transition?.enter}
      data-transition-exit={transition?.exit}
    >
      {text}
    </span>
  ),
}));

describe("App", () => {
  let host: HTMLDivElement;

  afterEach(() => {
    host.remove();
  });

  function renderApp() {
    host = document.createElement("div");
    document.body.append(host);
    act(() => {
      createRoot(host).render(<App />);
    });
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
    expect(host.querySelector('select[name="align"]')).not.toBeNull();
    expect(host.querySelector('input[name="hover"]')).not.toBeNull();

    const title = host.querySelector(
      '.preview-title [data-sharded-text="Settings"]',
    );
    expect(title?.getAttribute("data-shared-id")).toBe("title:settings");
    expect(title?.getAttribute("data-transition-enter")).toBe("settle");
    expect(title?.getAttribute("data-transition-exit")).toBe("scatter");
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
