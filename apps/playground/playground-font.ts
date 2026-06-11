import { fileURLToPath } from "node:url";

const bundledPlaygroundFont = fileURLToPath(
  new URL("./fonts/title.ttf", import.meta.url),
);

export function resolvePlaygroundFont(
  env: { TYPE_SHARDS_FONT?: string } = process.env,
) {
  return env.TYPE_SHARDS_FONT ?? bundledPlaygroundFont;
}
