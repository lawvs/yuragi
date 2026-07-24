import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ShardAnimationHandle,
  type ShardAnimationResult,
  type TextOutline,
} from "@yuragi-labs/core";
import { YuragiFontProvider, YuragiText } from "../src/index";

const coreMocks = vi.hoisted(() => ({
  prepareShardAnimation: vi.fn(),
}));

function animationHandle(
  finished:
    | Promise<ShardAnimationResult>
    | ShardAnimationResult = { status: "completed" },
): ShardAnimationHandle {
  return {
    play: vi.fn(),
    cancel: vi.fn(),
    finished: Promise.resolve(finished),
  };
}

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return {
    ...actual,
    prepareShardAnimation: coreMocks.prepareShardAnimation,
  };
});

beforeEach(() => {
  coreMocks.prepareShardAnimation.mockReset();
  coreMocks.prepareShardAnimation.mockImplementation(() =>
    animationHandle(),
  );
});

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("runtime animations", () => {
  afterEach(() => {
    cleanup();
  });

  it("completes one exit when runtime text changes", async () => {
    const first = deferred<TextOutline>();
    const second = deferred<TextOutline>();
    const onExitComplete = vi.fn();
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn((text: string) =>
        text === "First" ? first.promise : second.promise,
      ),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const { rerender } = render(
      <YuragiFontProvider font={font} includeStyles={false}>
        <YuragiText
          text="First"
          onExitComplete={onExitComplete}
        />
      </YuragiFontProvider>,
    );

    await act(async () => {
      first.resolve(outline);
      await first.promise;
    });

    rerender(
      <YuragiFontProvider font={font} includeStyles={false}>
        <YuragiText
          text="Second"
          onExitComplete={onExitComplete}
        />
      </YuragiFontProvider>,
    );

    await waitFor(() => {
      expect(
        coreMocks.prepareShardAnimation.mock.calls.filter(
          ([, options]) => options.type === "scatter",
        ),
      ).toHaveLength(1);
      expect(onExitComplete).toHaveBeenCalledOnce();
    });
  });
});
