import { describe, expect, it } from "vitest";
import type { FontAxes, FontAxisTag, TextOutlineBundle } from "../src";

describe("font axis types", () => {
  it("accepts known OpenType axes and custom axes", () => {
    const knownAxis: FontAxisTag = "wght";
    const customAxis: FontAxisTag = "TEST";
    const axes = {
      wght: 900,
      opsz: 18,
      XOPQ: 120,
      TEST: 1,
    } satisfies FontAxes;

    const bundle = {
      version: 1,
      font: {
        source: "font.otf",
        axes,
        unitsPerEm: 1000,
        hash: "hash",
      },
      outlines: {},
    } satisfies TextOutlineBundle;

    expect(knownAxis).toBe("wght");
    expect(customAxis).toBe("TEST");
    expect(bundle.font.axes?.wght).toBe(900);
  });

  it("rejects non-numeric axis values", () => {
    const axes = {
      // @ts-expect-error font variation axis values must be numeric.
      wght: "900",
    } satisfies FontAxes;

    expect(axes.wght).toBe("900");
  });
});
