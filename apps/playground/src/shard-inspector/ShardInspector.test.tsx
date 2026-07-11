import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextOutline } from "@yuragi/core";
import { ShardInspector } from "./ShardInspector";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class FakeWorker {
  static instances: FakeWorker[] = [];

  listeners = new Set<(event: MessageEvent) => void>();
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(_type: "message", listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  emit(data: unknown) {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent);
    }
  }
}

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [
    {
      text: "ab",
      advance: 900,
      breakAfter: true,
      glyphs: [
        {
          char: "a",
          advance: 400,
          bbox: { top: -700, bottom: 0, left: 0, right: 380 },
          shards: [{ path: "M0 0L1 1Z", direction: [1, 0] }],
        },
        {
          char: "b",
          advance: 500,
          bbox: { top: -800, bottom: 0, left: 0, right: 480 },
          shards: [
            { path: "M0 0L2 2Z", direction: [0, 1] },
            { path: "M2 2L3 3Z", direction: [-1, 0] },
          ],
        },
      ],
    },
  ],
};

function outlineFor(char: "a" | "b"): TextOutline {
  const glyph = outline.groups[0]!.glyphs.find(
    (candidate) => candidate.char === char,
  )!;
  return {
    ...outline,
    groups: [
      {
        text: char,
        advance: glyph.advance,
        breakAfter: true,
        glyphs: [glyph],
      },
    ],
  };
}

describe("ShardInspector", () => {
  let host: HTMLDivElement;
  let originalWorker: typeof Worker | undefined;

  beforeEach(() => {
    FakeWorker.instances = [];
    originalWorker = globalThis.Worker;
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
    if (originalWorker) {
      globalThis.Worker = originalWorker;
    } else {
      Reflect.deleteProperty(globalThis, "Worker");
    }
  });

  it("loads the default font, compiles the catalog, and exposes shard counts", () => {
    act(() => {
      createRoot(host).render(<ShardInspector />);
    });

    const worker = FakeWorker.instances[0]!;
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "load-wasm",
      wasmUrl: "/yuragi-wasm/yuragi_wasm_compiler.wasm",
    });
    expect(host.querySelector(".inspector-status")?.textContent).toBe(
      "Loading WASM...",
    );

    act(() => {
      worker.emit({ type: "wasm-ready", wasmBytes: 10, wasmLoadMs: 1 });
    });
    expect(host.querySelector(".inspector-status")?.textContent).toBe(
      "Loading font...",
    );
    const fontMessage = worker.postMessage.mock.calls.find(
      ([message]) => message.type === "load-remote-font",
    )?.[0];
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "load-remote-font",
        fontUrl: expect.stringContaining("SourceHanSerifSC-VF.otf"),
        loadId: expect.any(String),
      }),
    );

    act(() => {
      worker.emit({
        type: "font-ready",
        fontBytes: 20,
        fontLoadMs: 2,
        unitsPerEm: 1000,
        loadId: fontMessage.loadId,
      });
    });
    expect(host.querySelector(".inspector-status")?.textContent).toBe(
      "Compiling glyphs...",
    );
    const compileMessage = worker.postMessage.mock.calls.find(
      ([message]) => message.type === "compile-glyphs",
    )?.[0];
    expect(compileMessage?.glyphs.join("")).toContain(
      "abcdefghijklmnopqrstuvwxyz",
    );
    expect(compileMessage?.glyphs.join("")).toContain("あいうえお");

    act(() => {
      worker.emit({
        type: "glyphs-compiled",
        requestId: compileMessage.requestId,
        results: [
          { glyph: "a", outline: outlineFor("a") },
          { glyph: "b", outline: outlineFor("b") },
        ],
        compileMs: 3,
        outlineBytes: 30,
        wasmBytes: 10,
        fontBytes: 20,
      });
    });

    expect(
      host.querySelector('[data-glyph="a"] [data-shard-count]')?.textContent,
    ).toBe("1");
    expect(host.querySelector('[data-glyph="c"]')?.textContent).toContain(
      "Missing",
    );
    expect(host.querySelector(".inspector-status")?.textContent).toContain(
      "2 of 155",
    );

    act(() => {
      host.querySelector<HTMLButtonElement>('[data-glyph="b"]')?.click();
    });
    expect(host.querySelector(".glyph-detail")?.textContent).toContain(
      "2 shards",
    );
    expect(host.querySelectorAll("[data-shard-index]")).toHaveLength(2);

    act(() => {
      host
        .querySelector<HTMLButtonElement>('button[data-mode="exploded"]')
        ?.click();
    });
    const explode = host.querySelector<HTMLInputElement>(
      'input[name="explode-distance"]',
    );
    expect(explode).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(explode, "60");
      explode?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(
      host.querySelector<SVGGElement>('[data-inspector-shard="0"]')?.style
        .transform,
    ).toContain("60px");

    act(() => {
      host
        .querySelector<HTMLButtonElement>('[data-shard-index="1"]')
        ?.click();
    });
    expect(
      host
        .querySelector<HTMLButtonElement>('[data-shard-index="1"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      host.querySelector<HTMLButtonElement>('[data-action="play-settle"]'),
    ).not.toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>('[data-action="play-scatter"]'),
    ).not.toBeNull();

    act(() => {
      host
        .querySelector<HTMLButtonElement>('[data-action="play-settle"]')
        ?.click();
    });
    expect(
      host
        .querySelector<HTMLButtonElement>('button[data-mode="assembled"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("ignores stale font loads and does not reload WASM", () => {
    act(() => {
      createRoot(host).render(<ShardInspector />);
    });

    const worker = FakeWorker.instances[0]!;
    act(() => {
      worker.emit({ type: "wasm-ready", wasmBytes: 10, wasmLoadMs: 1 });
    });
    const initialFontMessage = worker.postMessage.mock.calls.find(
      ([message]) => message.type === "load-remote-font",
    )?.[0];

    const preset = host.querySelector<HTMLSelectElement>(
      'select[name="inspector-font-preset"]',
    )!;
    act(() => {
      preset.value = "inter";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
    });
    act(() => {
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Apply font")
        ?.click();
    });

    const fontMessages = worker.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === "load-remote-font");
    expect(fontMessages).toHaveLength(2);
    expect(fontMessages[1].loadId).not.toBe(initialFontMessage.loadId);
    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "load-wasm",
      ),
    ).toHaveLength(1);

    act(() => {
      worker.emit({
        type: "font-ready",
        loadId: initialFontMessage.loadId,
        fontBytes: 20,
        fontLoadMs: 2,
        unitsPerEm: 1000,
      });
    });
    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "compile-glyphs",
      ),
    ).toHaveLength(0);

    act(() => {
      worker.emit({
        type: "font-ready",
        loadId: fontMessages[1].loadId,
        fontBytes: 20,
        fontLoadMs: 2,
        unitsPerEm: 1000,
      });
    });
    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "compile-glyphs",
      ),
    ).toHaveLength(1);
    expect(
      host.querySelector<HTMLInputElement>('input[name="inspector-local-font"]')
        ?.accept,
    ).toBe(".otf,.ttf,font/otf,font/ttf");
  });

  it("ignores a local file read superseded by a remote font", async () => {
    act(() => {
      createRoot(host).render(<ShardInspector />);
    });

    const worker = FakeWorker.instances[0]!;
    act(() => {
      worker.emit({ type: "wasm-ready", wasmBytes: 10, wasmLoadMs: 1 });
    });

    let resolveLocalFont: (bytes: ArrayBuffer) => void = () => {};
    const localFont = {
      arrayBuffer: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveLocalFont = resolve;
          }),
      ),
    } as unknown as File;
    const input = host.querySelector<HTMLInputElement>(
      'input[name="inspector-local-font"]',
    )!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [localFont],
    });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const preset = host.querySelector<HTMLSelectElement>(
      'select[name="inspector-font-preset"]',
    )!;
    act(() => {
      preset.value = "inter";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Apply font")
        ?.click();
    });

    await act(async () => {
      resolveLocalFont(new ArrayBuffer(8));
      await Promise.resolve();
    });

    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "load-local-font",
      ),
    ).toHaveLength(0);
    expect(
      worker.postMessage.mock.calls.at(-1)?.[0],
    ).toEqual(expect.objectContaining({ type: "load-remote-font" }));
  });

  it("does not apply the default font after a preset changes during startup", () => {
    act(() => {
      createRoot(host).render(<ShardInspector />);
    });

    const worker = FakeWorker.instances[0]!;
    const preset = host.querySelector<HTMLSelectElement>(
      'select[name="inspector-font-preset"]',
    )!;
    act(() => {
      preset.value = "inter";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
      worker.emit({ type: "wasm-ready", wasmBytes: 10, wasmLoadMs: 1 });
    });

    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "load-remote-font",
      ),
    ).toHaveLength(0);
    expect(host.querySelector(".inspector-status")?.textContent).toContain(
      "Apply the selected font",
    );

    act(() => {
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent?.trim() === "Apply font")
        ?.click();
    });
    expect(worker.postMessage.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        type: "load-remote-font",
        fontUrl: expect.stringContaining("Inter"),
      }),
    );
  });
});
