import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileOutlines } from "@yuragi/compiler";
import titles from "../src/titles.json" with { type: "json" };

const font = process.env.YURAGI_FONT;

if (!font) {
  throw new Error(
    "Set YURAGI_FONT to a local font file before generating static outlines.",
  );
}

const bundle = await compileOutlines({
  font,
  axes: { wght: 900 },
  titles,
});
const output = fileURLToPath(
  new URL("../src/generated/outlines.json", import.meta.url),
);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(bundle.outlines, null, 2)}\n`);
console.log(`[yuragi static example] wrote ${output}`);
