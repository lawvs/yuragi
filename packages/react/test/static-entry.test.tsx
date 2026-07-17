import { describe, expect, expectTypeOf, it } from "vitest";
import {
  YuragiText as RuntimeYuragiText,
  type YuragiTextProps,
} from "../src/index";
import {
  YuragiStyles,
  YuragiText,
  type StaticYuragiTextProps,
} from "../src/static";

const outline = {
  em: 1000,
  ascender: 800,
  descender: -200,
  groups: [],
};

describe("@yuragi-labs/react/static", () => {
  it("exports the static text renderer separately from the runtime entry", () => {
    expect(YuragiStyles).toBeTypeOf("function");
    expect(YuragiText).toBeTypeOf("function");
    expect(RuntimeYuragiText).not.toBe(YuragiText);
  });

  it("keeps runtime and static text props distinct", () => {
    expectTypeOf<"outline">().toMatchTypeOf<keyof StaticYuragiTextProps>();
    expectTypeOf<"outline">().not.toMatchTypeOf<keyof YuragiTextProps>();
    expectTypeOf(outline).toMatchTypeOf<StaticYuragiTextProps["outline"]>();
  });
});
