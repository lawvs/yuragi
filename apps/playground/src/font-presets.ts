import type { FontAxes } from "@yuragi-labs/core";
import {
  SOURCE_HAN_SERIF_AXES,
  SOURCE_HAN_SERIF_URL,
} from "../../../shared/source-han-serif";
import wasmUrl from "@yuragi-labs/wasm/yuragi_wasm_compiler.wasm?url";

export const DEFAULT_WASM_URL = wasmUrl;

export const DEFAULT_FONT_URL =
  import.meta.env.YURAGI_PLAYGROUND_FONT_URL || SOURCE_HAN_SERIF_URL;

export const DEFAULT_AXES = SOURCE_HAN_SERIF_AXES satisfies FontAxes;

export type FontPreset = {
  id: string;
  label: string;
  url: string;
  sampleText: string;
  axes: FontAxes;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "source-han-serif-sc",
    label: "Source Han Serif SC VF",
    url: DEFAULT_FONT_URL,
    sampleText: "Yuragi",
    axes: DEFAULT_AXES,
  },
  {
    id: "noto-sans-sc",
    label: "Noto Sans SC",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    sampleText: "Yuragi",
    axes: DEFAULT_AXES,
  },
  {
    id: "noto-serif-sc",
    label: "Noto Serif SC",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
    sampleText: "Yuragi",
    axes: DEFAULT_AXES,
  },
  {
    id: "ma-shan-zheng",
    label: "Ma Shan Zheng",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    sampleText: "Yuragi",
    axes: DEFAULT_AXES,
  },
  {
    id: "inter",
    label: "Inter Variable",
    url:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf",
    sampleText: "Dashboard",
    axes: { wght: 900 } satisfies FontAxes,
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
