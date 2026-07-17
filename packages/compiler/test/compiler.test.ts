import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  compileOutlines,
  type CompileOutlinesOptions,
} from "../src/index";

const native = vi.hoisted(() => ({
  runNativeCompiler: vi.fn(async () => ({})),
}));

vi.mock("../src/native", () => native);

describe("compileOutlines", () => {
  beforeEach(() => {
    native.runNativeCompiler.mockClear();
  });

  it("accepts readonly titles and deduplicates them while preserving order", async () => {
    await compileOutlines({
      font: "font.otf",
      titles: ["Dashboard", "Settings", "Dashboard"] as const,
    });

    expect(native.runNativeCompiler).toHaveBeenCalledWith({
      font: "font.otf",
      axes: undefined,
      titles: ["Dashboard", "Settings"],
    });
  });

  it("rejects dynamic title callbacks at the type boundary", () => {
    type Titles = CompileOutlinesOptions["titles"];

    expectTypeOf<readonly string[]>().toMatchTypeOf<Titles>();
    expectTypeOf<() => Promise<string[]>>().not.toMatchTypeOf<Titles>();
  });
});
