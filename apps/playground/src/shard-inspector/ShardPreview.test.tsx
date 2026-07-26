import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import type {
  RenderYuragiTextOptions,
  YuragiTextHandle,
  YuragiTextResult,
} from "@yuragi-labs/core";
import { ShardPreview, type InspectorPlayback } from "./ShardPreview";
import type { InspectorGlyph } from "./model";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const coreMocks = vi.hoisted(() => ({
  renderYuragiText: vi.fn(),
}));

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return {
    ...actual,
    renderYuragiText: coreMocks.renderYuragiText,
  };
});

type TestHandle = YuragiTextHandle & {
  play: Mock<YuragiTextHandle["play"]>;
  cancel: Mock<YuragiTextHandle["cancel"]>;
  remove: Mock<YuragiTextHandle["remove"]>;
  dispose: Mock<YuragiTextHandle["dispose"]>;
};

let removalResults: Array<
  YuragiTextResult | Promise<YuragiTextResult>
> = [];
let handles: TestHandle[] = [];

function rendererHandle(target: Element): TestHandle {
  const svg = target.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  svg.dataset.yuragiRoot = "true";
  const motion = target.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  motion.dataset.shardMotion = "true";
  const path = target.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  path.dataset.shard = "true";
  motion.append(path);
  svg.append(motion);
  const removal =
    removalResults.shift() ??
    ({ status: "completed" } satisfies YuragiTextResult);
  const playbackResult = {
    status: "completed",
  } satisfies YuragiTextResult;
  const handle: TestHandle = {
    element: svg,
    play: vi.fn(async () => playbackResult),
    cancel: vi.fn(),
    remove: vi.fn(() => {
      svg.remove();
      return Promise.resolve(removal);
    }),
    dispose: vi.fn(() => svg.remove()),
  };
  target.replaceChildren(svg);
  handles.push(handle);
  return handle;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function glyph(char: string): InspectorGlyph {
  const shard = {
    path: "M0 0L10 0L10 10Z",
    direction: [1, 0],
  } as const;
  const outline = {
    em: 1000,
    ascender: 800,
    descender: -200,
    groups: [
      {
        text: char,
        advance: 500,
        breakAfter: true,
        glyphs: [
          {
            char,
            advance: 500,
            bbox: {
              top: -800,
              bottom: 0,
              left: 0,
              right: 500,
            },
            shards: [shard],
          },
        ],
      },
    ],
  };
  return { char, advance: 500, shards: [shard], outline };
}

function preview(
  data: InspectorGlyph,
  playback: InspectorPlayback | null,
  onSelectShard = vi.fn(),
) {
  return (
    <ShardPreview
      data={data}
      explodeDistance={80}
      mode="assembled"
      onPlay={vi.fn()}
      playback={playback}
      onSelectShard={onSelectShard}
      selectedShard={null}
    />
  );
}

describe("ShardPreview", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    removalResults = [];
    handles = [];
    coreMocks.renderYuragiText.mockReset();
    coreMocks.renderYuragiText.mockImplementation(
      (
        target: Element,
        _outline: InspectorGlyph["outline"],
        _options: RenderYuragiTextOptions,
      ) => rendererHandle(target),
    );
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders a static public handle and preserves shard selection", () => {
    const data = glyph("a");
    const onSelectShard = vi.fn();

    act(() => {
      root.render(preview(data, null, onSelectShard));
    });

    expect(coreMocks.renderYuragiText).toHaveBeenCalledWith(
      expect.any(HTMLSpanElement),
      data.outline,
      {
        size: 220,
        ariaLabel: "a",
        animation: false,
      },
    );
    expect(handles[0]?.element.classList).toContain("inspector-glyph-svg");
    act(() => {
      host
        .querySelector("[data-shard]")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelectShard).toHaveBeenCalledWith(0);
  });

  it("disposes the old handle before rendering changed glyph data", () => {
    act(() => {
      root.render(preview(glyph("a"), null));
    });
    const first = handles[0]!;

    act(() => {
      root.render(preview(glyph("b"), null));
    });

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(handles[1]?.element.isConnected).toBe(true);
  });

  it("creates and plays a prepared public handle for settle playback", () => {
    const data = glyph("a");
    act(() => {
      root.render(preview(data, null));
    });

    act(() => {
      root.render(
        preview(data, { type: "settle", distance: 80 }),
      );
    });

    expect(handles[0]?.dispose).toHaveBeenCalledOnce();
    expect(coreMocks.renderYuragiText).toHaveBeenLastCalledWith(
      expect.any(HTMLSpanElement),
      data.outline,
      {
        size: 220,
        ariaLabel: "a",
        animation: {
          autoplay: false,
          distance: 80,
          stagger: "by-x",
        },
      },
    );
    expect(handles[1]?.play).toHaveBeenCalledOnce();
  });

  it("removes for scatter and restores a static handle afterwards", async () => {
    const removal = deferred<YuragiTextResult>();
    removalResults.push(removal.promise);
    const data = glyph("a");
    act(() => {
      root.render(preview(data, null));
    });
    const assembled = handles[0]!;

    act(() => {
      root.render(
        preview(data, { type: "scatter", distance: 96 }),
      );
    });

    expect(assembled.remove).toHaveBeenCalledWith({ distance: 96 });
    expect(coreMocks.renderYuragiText).toHaveBeenCalledTimes(1);

    await act(async () => {
      removal.resolve({ status: "completed" });
      await removal.promise;
    });

    expect(coreMocks.renderYuragiText).toHaveBeenCalledTimes(2);
    expect(
      coreMocks.renderYuragiText.mock.calls[1]?.[2],
    ).toEqual({
      size: 220,
      ariaLabel: "a",
      animation: false,
    });
    expect(handles[1]?.element.isConnected).toBe(true);
  });

  it("disposes the current handle on unmount", () => {
    act(() => {
      root.render(preview(glyph("a"), null));
    });
    const handle = handles[0]!;

    act(() => root.unmount());

    expect(handle.dispose).toHaveBeenCalledOnce();
    root = createRoot(host);
  });
});
