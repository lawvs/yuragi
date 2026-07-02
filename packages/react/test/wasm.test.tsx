import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeShardsFontProvider, ShardedText } from "../src/wasm";
import { createTypeShardsFont } from "@yuragi/wasm";
import type { TextOutline } from "@yuragi/core";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

vi.mock("@yuragi/wasm", () => ({
  createTypeShardsFont: vi.fn(),
}));

vi.mock("../src/ShardedText", () => ({
  ShardedText: ({
    text,
    outline,
    fallback,
    sharedId,
  }: {
    text: string;
    outline?: TextOutline;
    fallback?: string;
    sharedId?: string | false;
  }) => (
    <span
      data-fallback={fallback}
      data-has-outline={outline ? "yes" : "no"}
      data-sharded-text={text}
      data-shared-id={sharedId || undefined}
    >
      {text}
    </span>
  ),
}));

describe("@yuragi/react/wasm", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(createTypeShardsFont).mockReset();
  });

  it("loads a font provider and resolves outlines for ShardedText", async () => {
    const font = {
      info: { bytes: 3, unitsPerEm: 1000 },
      compile: vi.fn(async () => outline),
      preload: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };
    vi.mocked(createTypeShardsFont).mockResolvedValue(font);

    render(
      <TypeShardsFontProvider
        font={new Uint8Array([1, 2, 3])}
        axes={{ wght: 900 }}
        preload={["复杂分层"]}
      >
        <ShardedText
          text="复杂分层"
          fallback="text"
          sharedId="title:runtime"
        />
      </TypeShardsFontProvider>,
    );

    expect(screen.getByText("复杂分层").dataset.hasOutline).toBe("no");

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(createTypeShardsFont).toHaveBeenCalledWith({
      font: expect.any(Uint8Array),
      axes: { wght: 900 },
      wasm: undefined,
      preload: ["复杂分层"],
    });
    expect(font.compile).toHaveBeenCalledWith("复杂分层");
    expect(screen.getByText("复杂分层").dataset.hasOutline).toBe("yes");
    expect(screen.getByText("复杂分层").dataset.sharedId).toBe(
      "title:runtime",
    );

    cleanup();
    expect(font.dispose).toHaveBeenCalled();
  });

  it("throws when ShardedText is rendered without a TypeShardsFontProvider", () => {
    expect(() => render(<ShardedText text="Missing Provider" />)).toThrow(
      "ShardedText from @yuragi/react/wasm requires TypeShardsFontProvider",
    );
  });
});
