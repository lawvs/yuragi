import { describe, expect, it } from "vitest";
import { YuragiStyles, YuragiText } from "../src/static";
import { YuragiText as RuntimeYuragiText } from "../src/index";

describe("@yuragi/react/static", () => {
  it("exports the static text renderer separately from the runtime entry", () => {
    expect(YuragiStyles).toBeTypeOf("function");
    expect(YuragiText).toBeTypeOf("function");
    expect(RuntimeYuragiText).not.toBe(YuragiText);
  });
});
