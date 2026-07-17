import { describe, expectTypeOf, it } from "vitest";
import type { FontAxes, FontAxisTag, TextOutlineBundle } from "../src";

describe("font axis types", () => {
  it("accepts numeric known and custom axes but rejects other values", () => {
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

    expectTypeOf<"wght">().toMatchTypeOf<FontAxisTag>();
    expectTypeOf<"TEST">().toMatchTypeOf<FontAxisTag>();
    expectTypeOf(axes).toMatchTypeOf<FontAxes>();
    expectTypeOf(bundle).toMatchTypeOf<TextOutlineBundle>();
    expectTypeOf({ wght: "900" }).not.toMatchTypeOf<FontAxes>();
  });
});
