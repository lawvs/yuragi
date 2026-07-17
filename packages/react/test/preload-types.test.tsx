import { describe, expectTypeOf, it } from "vitest";
import type { YuragiFontProviderProps } from "../src/index";

describe("YuragiFontProvider preload types", () => {
  it("accepts explicit title lists but not boolean flags", () => {
    type Preload = YuragiFontProviderProps["preload"];

    expectTypeOf<readonly string[]>().toMatchTypeOf<Preload>();
    expectTypeOf<boolean>().not.toMatchTypeOf<Preload>();
  });
});
