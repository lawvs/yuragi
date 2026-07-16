import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileOutlines } from "@yuragi-labs/compiler";
import {
  SOURCE_HAN_SERIF_AXES,
  SOURCE_HAN_SERIF_SHA256,
} from "../../../shared/source-han-serif";
import { resolveHeroFont } from "../playground-font";

const HERO_TEXT = "yuragi";
const output = fileURLToPath(
  new URL("../src/hero/hero-outline.json", import.meta.url),
);

const bundle = await compileOutlines({
  font: await resolveHeroFont(),
  axes: SOURCE_HAN_SERIF_AXES,
  titles: [HERO_TEXT],
});
const outline = bundle.outlines[HERO_TEXT];

if (bundle.font.hash !== SOURCE_HAN_SERIF_SHA256) {
  throw new Error(
    `Unexpected hero font checksum: ${bundle.font.hash}`,
  );
}

if (!outline) {
  throw new Error(`Missing generated outline for "${HERO_TEXT}"`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      text: HERO_TEXT,
      font: {
        sha256: bundle.font.hash,
        axes: bundle.font.axes,
        unitsPerEm: bundle.font.unitsPerEm,
      },
      outline,
    },
    null,
    2,
  )}\n`,
);

console.log(`[yuragi playground] wrote ${output}`);
