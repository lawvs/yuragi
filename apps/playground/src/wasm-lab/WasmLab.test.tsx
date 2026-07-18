import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WasmLab } from "./WasmLab";

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

function clickButton(host: HTMLElement, label: string) {
  const button = Array.from(host.querySelectorAll("button")).find((element) =>
    element.textContent?.includes(label),
  );
  expect(button).toBeDefined();
  button?.click();
}

describe("WasmLab", () => {
  let host: HTMLDivElement;
  let root: Root;
  let originalWorker: typeof Worker | undefined;

  beforeEach(() => {
    FakeWorker.instances = [];
    originalWorker = globalThis.Worker;
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    host.remove();
    if (originalWorker) {
      globalThis.Worker = originalWorker;
    } else {
      Reflect.deleteProperty(globalThis, "Worker");
    }
  });

  it("ignores a local font read superseded by a later remote load", async () => {
    act(() => {
      root.render(<WasmLab />);
    });
    const worker = FakeWorker.instances[0]!;

    let resolveLocalFont: (bytes: ArrayBuffer) => void = () => {};
    const localFont = {
      arrayBuffer: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveLocalFont = resolve;
          }),
      ),
    } as unknown as File;
    const localInput = host.querySelector<HTMLInputElement>(
      'input[name="wasm-local-font"]',
    )!;
    Object.defineProperty(localInput, "files", {
      configurable: true,
      value: [localFont],
    });
    act(() => {
      localInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const preset = host.querySelector<HTMLSelectElement>(
      'select[name="wasm-font-preset"]',
    )!;
    act(() => {
      preset.value = "inter";
      preset.dispatchEvent(new Event("change", { bubbles: true }));
      clickButton(host, "Load compiler and font");
    });

    await act(async () => {
      resolveLocalFont(new ArrayBuffer(8));
      await Promise.resolve();
    });

    act(() => {
      worker.emit({ type: "wasm-ready", wasmBytes: 4096, wasmLoadMs: 5 });
    });

    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "load-local-font",
      ),
    ).toHaveLength(0);
    expect(
      worker.postMessage.mock.calls
        .map(([message]) => message)
        .filter((message) => message.type === "load-remote-font")
        .at(-1),
    ).toEqual(
      expect.objectContaining({
        fontUrl: expect.stringContaining("Inter%5Bopsz,wght%5D.ttf"),
      }),
    );
  });
});
