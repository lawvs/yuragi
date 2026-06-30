import { describe, expect, it } from "vitest";
import { formatBytes, summarizeCompileMetrics } from "./metrics";

describe("WASM Lab metrics", () => {
  it("formats byte counts for quick bundle and font size comparisons", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(55_574_528)).toBe("53.0 MB");
  });

  it("summarizes compile measurements with fallback visibility", () => {
    expect(
      summarizeCompileMetrics({
        wasmBytes: 1_310_720,
        fontBytes: 55_574_528,
        wasmLoadMs: 34.26,
        fontLoadMs: 612.4,
        compileMs: 18.94,
        outlineBytes: 5_743,
        usedFallback: true,
      }),
    ).toEqual([
      { label: "WASM", value: "1.3 MB", detail: "34.3 ms" },
      { label: "Font", value: "53.0 MB", detail: "612.4 ms" },
      { label: "Compile", value: "18.9 ms", detail: "fallback text" },
      { label: "Outline", value: "5.7 KB", detail: "JSON" },
    ]);
  });
});
