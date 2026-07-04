import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { YURAGI_STYLE_TEXT } from "../src/style-text";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("YURAGI_STYLE_TEXT", () => {
  it("matches the package CSS file", async () => {
    const css = await readFile(resolve(packageDir, "src/style.css"), "utf8");

    expect(YURAGI_STYLE_TEXT).toBe(css);
  });
});
