import { describe, expect, it } from "vitest";
import { createStaticOutlineProvider } from "../src/index";
import type { OutlineMap, TextOutline } from "../src/types";

const outline: TextOutline = {
  em: 1000,
  ascender: 880,
  descender: -120,
  groups: [],
};

describe("createStaticOutlineProvider", () => {
  it("returns outlines synchronously", () => {
    const outlines = { Dashboard: outline } satisfies OutlineMap;
    const provider = createStaticOutlineProvider(outlines);

    expect(provider.get("Dashboard")).toBe(outline);
    expect(provider.get("Missing")).toBeUndefined();
  });

  it("resolves known outlines", async () => {
    const provider = createStaticOutlineProvider({ Dashboard: outline });

    await expect(provider.resolve("Dashboard")).resolves.toBe(outline);
  });

  it("rejects missing outlines with text in the error", async () => {
    const provider = createStaticOutlineProvider({});

    await expect(provider.resolve("Missing")).rejects.toThrow(
      'No type-shards outline found for "Missing"',
    );
  });

  it("preload is a no-op for static data", async () => {
    const provider = createStaticOutlineProvider({ Dashboard: outline });

    await expect(provider.preload(["Dashboard"])).resolves.toBeUndefined();
  });
});
