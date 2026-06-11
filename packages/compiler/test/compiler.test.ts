import { describe, expect, it } from "vitest";
import { normalizeTitles } from "../src/index";

describe("normalizeTitles", () => {
  it("deduplicates titles while preserving order", async () => {
    await expect(
      normalizeTitles(["Dashboard", "Settings", "Dashboard"]),
    ).resolves.toEqual(["Dashboard", "Settings"]);
  });

  it("accepts async title functions", async () => {
    await expect(
      normalizeTitles(async () => ["A", "B", "A"]),
    ).resolves.toEqual(["A", "B"]);
  });
});
