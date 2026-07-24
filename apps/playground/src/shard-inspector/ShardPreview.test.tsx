import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ShardAnimationHandle,
  ShardAnimationResult,
} from "@yuragi-labs/core";
import { ShardPreview, type InspectorPlayback } from "./ShardPreview";
import type { InspectorGlyph } from "./model";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const coreMocks = vi.hoisted(() => ({
  prepareShardAnimation: vi.fn(),
}));

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return {
    ...actual,
    prepareShardAnimation: coreMocks.prepareShardAnimation,
  };
});

function animationHandle(
  finished: ShardAnimationResult = { status: "completed" },
): ShardAnimationHandle {
  return {
    play: vi.fn(),
    cancel: vi.fn(),
    finished: Promise.resolve(finished),
  };
}

function glyph(char: string): InspectorGlyph {
  const shard = { path: "M0 0L10 0L10 10Z", direction: [1, 0] } as const;
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
            bbox: { top: -800, bottom: 0, left: 0, right: 500 },
            shards: [shard],
          },
        ],
      },
    ],
  };
  return { char, advance: 500, shards: [shard], outline };
}

describe("ShardPreview", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    coreMocks.prepareShardAnimation.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("cancels playback before replacing the rendered SVG", () => {
    const playback: InspectorPlayback = { type: "settle", distance: 80 };
    const handle = animationHandle();
    coreMocks.prepareShardAnimation.mockReturnValue(handle);

    act(() => {
      root.render(
        <ShardPreview
          data={glyph("a")}
          explodeDistance={80}
          mode="assembled"
          onPlay={vi.fn()}
          playback={playback}
          onSelectShard={vi.fn()}
          selectedShard={null}
        />,
      );
    });
    const firstSvg = host.querySelector("svg");
    expect(firstSvg).not.toBeNull();
    expect(handle.play).toHaveBeenCalledOnce();

    act(() => {
      root.render(
        <ShardPreview
          data={glyph("b")}
          explodeDistance={80}
          mode="assembled"
          onPlay={vi.fn()}
          playback={playback}
          onSelectShard={vi.fn()}
          selectedShard={null}
        />,
      );
    });

    expect(host.querySelector("svg")).not.toBe(firstSvg);
    expect(handle.cancel).toHaveBeenCalledOnce();
  });
});
