import {
  resolveFont,
  SOURCE_HAN_SERIF_SHA256,
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

export function resolveHeroFont(
  options: Omit<ResolvePlaygroundFontOptions, "expectedSha256"> = {},
) {
  return resolveFont(
    {},
    { ...options, expectedSha256: SOURCE_HAN_SERIF_SHA256 },
  );
}
