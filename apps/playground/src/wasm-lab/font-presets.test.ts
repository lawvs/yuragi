import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_PRESET_ID,
  FONT_PRESETS,
  findFontPreset,
  resolveDefaultFontUrl,
} from "./config";

describe("WASM Lab font presets", () => {
  it("keeps Source Han as the default large-font baseline", () => {
    const preset = findFontPreset(DEFAULT_FONT_PRESET_ID);

    expect(preset.label).toContain("Source Han Serif");
    expect(preset.url).toContain("SourceHanSerifSC-VF.otf");
    expect(preset.sampleText).toBe("复杂分层");
    expect(preset.axes).toEqual({ wght: 900 });
  });

  it("includes Chinese and Latin comparison presets before custom URL", () => {
    expect(FONT_PRESETS.map((preset) => preset.id)).toEqual([
      "source-han-serif-sc",
      "noto-sans-sc",
      "noto-serif-sc",
      "ma-shan-zheng",
      "inter",
      "custom",
    ]);
    expect(findFontPreset("noto-sans-sc").url).toContain("NotoSansSC");
    expect(findFontPreset("noto-serif-sc").url).toContain("NotoSerifSC");
    expect(findFontPreset("ma-shan-zheng").sampleText).toBe("复杂分层");
    expect(findFontPreset("inter").sampleText).toBe("Dashboard");
    expect(findFontPreset("custom").url).toBe("");
  });

  it("prefers the Vite-served cached font during development", () => {
    expect(resolveDefaultFontUrl("/@fs/cache/SourceHanSerifSC-VF.otf")).toBe(
      "/@fs/cache/SourceHanSerifSC-VF.otf",
    );
    expect(resolveDefaultFontUrl("")).toContain(
      "raw.githubusercontent.com/adobe-fonts/source-han-serif",
    );
  });
});
