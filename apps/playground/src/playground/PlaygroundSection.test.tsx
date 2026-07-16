import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlaygroundSection } from "./PlaygroundSection";

vi.mock("../runtime-demo/RuntimeDemo", () => ({
  RuntimeDemo: () => <div data-playground-view="runtime-demo" />,
}));

vi.mock("../shard-inspector/ShardInspector", () => ({
  ShardInspector: () => <div data-playground-view="shard-inspector" />,
}));

vi.mock("../wasm-lab/WasmLab", () => ({
  WasmLab: () => <div data-playground-view="wasm-lab" />,
}));

describe("PlaygroundSection", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
  });

  it("owns the default view and tab navigation", () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<PlaygroundSection />));

    const runtimeTab = host.querySelector<HTMLButtonElement>(
      'button[data-view="runtime-demo"]',
    );
    const inspectorTab = host.querySelector<HTMLButtonElement>(
      'button[data-view="shard-inspector"]',
    );

    expect(runtimeTab?.getAttribute("aria-pressed")).toBe("true");
    expect(
      host.querySelector('[data-playground-view="runtime-demo"]'),
    ).not.toBeNull();

    act(() => inspectorTab?.click());

    expect(inspectorTab?.getAttribute("aria-pressed")).toBe("true");
    expect(
      host.querySelector('[data-playground-view="shard-inspector"]'),
    ).not.toBeNull();
    expect(
      host.querySelector('[data-playground-view="runtime-demo"]'),
    ).toBeNull();
  });
});
