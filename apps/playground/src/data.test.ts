// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { demoPosts, outlineTitles } from "./data";

describe("playground data", () => {
  it("derives outline titles from non-missing demo posts", () => {
    expect(outlineTitles).toEqual(
      demoPosts
        .filter((post) => post.id !== "missing")
        .map((post) => post.title),
    );
  });

  it("keeps outline titles derived from demoPosts in source", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./data.ts", import.meta.url)),
      "utf8",
    );

    expect(source).toMatch(/outlineTitles\s*=\s*demoPosts\s*\.\s*filter/s);
  });
});
