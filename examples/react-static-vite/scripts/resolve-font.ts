import { resolveFont as resolveCachedFont } from "../../../scripts/font-cache";

export function resolveFont(source?: string) {
  return resolveCachedFont(
    { YURAGI_FONT: source ?? process.env.YURAGI_FONT },
    { localBaseDir: process.cwd() },
  );
}
