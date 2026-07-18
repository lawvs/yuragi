import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_PRESET_ID,
  findFontPreset,
} from "./config";

describe("WASM Lab font presets", () => {
  it("provides the default font with a non-Chinese sample and a Latin comparison preset", () => {
    const preset = findFontPreset(DEFAULT_FONT_PRESET_ID);

    expect(preset.label).toContain("Source Han Serif");
    expect(preset.url).toContain("SourceHanSerifSC-VF.otf");
    expect(preset.sampleText).toBe("Yuragi");
    expect(preset.axes).toEqual({ wght: 900 });
    expect(findFontPreset("inter").sampleText).toBe("Dashboard");
    expect(findFontPreset("custom").url).toBe("");
  });
});
