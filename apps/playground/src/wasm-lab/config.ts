export const DEFAULT_WASM_URL =
  "/type-shards-wasm/yuragi_wasm_compiler.wasm";

export const DEFAULT_FONT_URL =
  "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/OTF/SourceHanSerifSC-VF.otf";

export const DEFAULT_AXES = { wght: 900 };

export type FontPreset = {
  id: string;
  label: string;
  url: string;
  sampleText: string;
  axes: Record<string, number>;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "source-han-serif-sc",
    label: "Source Han Serif SC VF",
    url: DEFAULT_FONT_URL,
    sampleText: "复杂分层",
    axes: DEFAULT_AXES,
  },
  {
    id: "noto-sans-sc",
    label: "Noto Sans SC",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    sampleText: "复杂分层",
    axes: DEFAULT_AXES,
  },
  {
    id: "noto-serif-sc",
    label: "Noto Serif SC",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    sampleText: "复杂分层",
    axes: DEFAULT_AXES,
  },
  {
    id: "ma-shan-zheng",
    label: "Ma Shan Zheng",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    sampleText: "复杂分层",
    axes: DEFAULT_AXES,
  },
  {
    id: "inter",
    label: "Inter Variable",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
    sampleText: "Dashboard",
    axes: { wght: 900 },
  },
  {
    id: "custom",
    label: "Custom URL",
    url: "",
    sampleText: "Custom Title",
    axes: DEFAULT_AXES,
  },
];

export const DEFAULT_FONT_PRESET_ID = FONT_PRESETS[0].id;

export function findFontPreset(id: string) {
  return (
    FONT_PRESETS.find((preset) => preset.id === id) ??
    FONT_PRESETS.find((preset) => preset.id === DEFAULT_FONT_PRESET_ID) ??
    FONT_PRESETS[0]
  );
}
