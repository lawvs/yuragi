// @vitest-environment node

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolvePlaygroundFont } from "../playground-font";

describe("resolvePlaygroundFont", () => {
  it("uses the bundled playground font by default", () => {
    const font = resolvePlaygroundFont({});

    expect(font).toMatch(/apps\/playground\/fonts\/title\.ttf$/);
    expect(existsSync(font)).toBe(true);
  });

  it("allows TYPE_SHARDS_FONT to override the bundled font", () => {
    expect(
      resolvePlaygroundFont({
        TYPE_SHARDS_FONT: "/tmp/custom-title.ttf",
      }),
    ).toBe("/tmp/custom-title.ttf");
  });
});
