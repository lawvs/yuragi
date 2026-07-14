import {
  SOURCE_HAN_SERIF_SHA256,
  SOURCE_HAN_SERIF_URL,
  resolveFont,
  type DownloadFont,
  type ResolveFontOptions,
} from "../../scripts/font-cache";

export const DEFAULT_PLAYGROUND_FONT_URL = SOURCE_HAN_SERIF_URL;
export const DEFAULT_PLAYGROUND_FONT_SHA256 = SOURCE_HAN_SERIF_SHA256;

export type { DownloadFont };
export type ResolvePlaygroundFontOptions = ResolveFontOptions;

export function resolvePlaygroundFont(
  env: { YURAGI_FONT?: string } = process.env,
  options: ResolvePlaygroundFontOptions = {},
) {
  return resolveFont(env, options);
}
