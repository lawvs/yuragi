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

    act(() => {
      worker.emit({ type: "wasm-ready", wasmBytes: 10, wasmLoadMs: 1 });
    });
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "load-remote-font",
        fontUrl: expect.stringContaining("SourceHanSerifSC-VF.otf"),
      }),
    );

    act(() => {
      worker.emit({
        type: "font-ready",
        fontBytes: 20,
        fontLoadMs: 2,
        unitsPerEm: 1000,
      });
    });
    const compileMessage = worker.postMessage.mock.calls.find(
      ([message]) => message.type === "compile",
    )?.[0];
    expect(compileMessage?.text).toContain("abcdefghijklmnopqrstuvwxyz");
    expect(compileMessage?.text).toContain("あいうえお");

    act(() => {
      worker.emit({
        type: "compiled",
        requestId: compileMessage.requestId,
        outline,
        compileMs: 3,
        outlineBytes: 30,
        wasmBytes: 10,
        fontBytes: 20,
      });
    });

    expect(
      host.querySelector('[data-glyph="a"] [data-shard-count]')?.textContent,
    ).toBe("1");

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
  });
});
