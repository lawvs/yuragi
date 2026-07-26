import { describe, expectTypeOf, it } from "vitest";
import type { YuragiTextProps } from "../src/index";
import type { StaticYuragiTextProps } from "../src/static";

describe("runtime fallback types", () => {
  it("accepts delayed text fallback only in the runtime entry", () => {
    type DelayedFallback = { delayMs: number };
    type RuntimeFallback = NonNullable<YuragiTextProps["fallback"]>;
    type StaticFallback = NonNullable<
      StaticYuragiTextProps["fallback"]
    >;

    expectTypeOf<DelayedFallback>().toMatchTypeOf<RuntimeFallback>();
    expectTypeOf<DelayedFallback>().not.toMatchTypeOf<StaticFallback>();
  });
});
