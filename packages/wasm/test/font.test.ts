import { describe, expect, it, vi } from "vitest";
import { createTypeShardsFont } from "../src/index";
import type { TextOutline } from "@type-shards/core";

const outline: TextOutline = {
  em: 1000,
  ascender: 800,
  descender: -200,
  groups: [],
};

describe("createTypeShardsFont", () => {
  it("loads the font bytes and compiles cached outlines with configured axes", async () => {
    const runtime = {
      setFont: vi.fn(() => ({ bytes: 3, unitsPerEm: 1000 })),
      compileTitle: vi.fn(() => outline),
    };

    const font = await createTypeShardsFont({
      font: new Uint8Array([1, 2, 3]),
      axes: { wght: 900 },
      runtime,
    });

    await expect(font.compile("复杂分层")).resolves.toBe(outline);
    await expect(font.compile("复杂分层")).resolves.toBe(outline);

    expect(runtime.setFont).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(runtime.compileTitle).toHaveBeenCalledTimes(1);
    expect(runtime.compileTitle).toHaveBeenCalledWith("复杂分层", {
      wght: 900,
    });
  });

  it("preloads titles and supports per-call axes overrides", async () => {
    const runtime = {
      setFont: vi.fn(() => ({ bytes: 2, unitsPerEm: 1000 })),
      compileTitle: vi.fn(() => outline),
    };

    const font = await createTypeShardsFont({
      font: () => Promise.resolve(new Uint8Array([7, 8])),
      axes: { wght: 700 },
      runtime,
      preload: ["Dashboard"],
    });

    await font.compile("Settings", { axes: { wght: 400 } });

    expect(runtime.compileTitle).toHaveBeenNthCalledWith(1, "Dashboard", {
      wght: 700,
    });
    expect(runtime.compileTitle).toHaveBeenNthCalledWith(2, "Settings", {
      wght: 400,
    });
  });
});
