import {
  resolveFont,
  type DownloadFont,
  type ResolveFontOptions,
} from "../../scripts/font-cache";

export type { DownloadFont };
export type ResolvePlaygroundFontOptions = ResolveFontOptions;

export function resolvePlaygroundFont(
  env: { YURAGI_FONT?: string } = process.env,
  options: ResolvePlaygroundFontOptions = {},
) {
  return resolveFont(env, options);
}
