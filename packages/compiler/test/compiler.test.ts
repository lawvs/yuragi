import { beforeEach, describe, expect, it, vi } from "vitest";
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
    const invalidOptions = {
      font: "font.otf",
      // @ts-expect-error Dynamic title discovery belongs in user build scripts.
      titles: async () => ["A"],
    } satisfies CompileOutlinesOptions;

    expect(invalidOptions.titles).toBeTypeOf("function");
  });
});
