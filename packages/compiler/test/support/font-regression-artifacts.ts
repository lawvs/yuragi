import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ShardGlyph, TextOutline } from "@yuragi-labs/core";
import type { GlyphSectionSnapshot } from "./font-regression";

export type GlyphChangeField =
  | "missing-expected"
  | "missing-actual"
  | "structure"
  | "metrics"
  | "advance"
  | "bbox"
  | "shard-count"
  | "path"
  | "direction";

export type GlyphChange = {
  char: string;
  codePoints: string[];
  fields: GlyphChangeField[];
};

type SnapshotGlyph = GlyphSectionSnapshot["glyphs"][number];

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function outlineGlyphs(outline: TextOutline) {
  return outline.groups.flatMap((group) => group.glyphs);
}

function outlineShards(outline: TextOutline) {
  return outlineGlyphs(outline).flatMap((glyph) => glyph.shards);
}

function changedFields(expected: SnapshotGlyph, actual: SnapshotGlyph) {
  const fields: GlyphChangeField[] = [];
  const expectedGlyphs = outlineGlyphs(expected.outline);
  const actualGlyphs = outlineGlyphs(actual.outline);
  const expectedShards = outlineShards(expected.outline);
  const actualShards = outlineShards(actual.outline);

  if (
    !equal(
      expected.outline.groups.map(({ text, breakAfter, glyphs }) => ({
        text,
        breakAfter,
        chars: glyphs.map((glyph) => glyph.char),
      })),
      actual.outline.groups.map(({ text, breakAfter, glyphs }) => ({
        text,
        breakAfter,
        chars: glyphs.map((glyph) => glyph.char),
      })),
    )
  ) {
    fields.push("structure");
  }

  if (
    !equal(
      [expected.outline.em, expected.outline.ascender, expected.outline.descender],
      [actual.outline.em, actual.outline.ascender, actual.outline.descender],
    )
  ) {
    fields.push("metrics");
  }

  if (
    !equal(
      {
        groups: expected.outline.groups.map((group) => group.advance),
        glyphs: expectedGlyphs.map((glyph) => glyph.advance),
      },
      {
        groups: actual.outline.groups.map((group) => group.advance),
        glyphs: actualGlyphs.map((glyph) => glyph.advance),
      },
    )
  ) {
    fields.push("advance");
  }

  if (
    !equal(
      expectedGlyphs.map((glyph) => glyph.bbox),
      actualGlyphs.map((glyph) => glyph.bbox),
    )
  ) {
    fields.push("bbox");
  }

  if (expectedShards.length !== actualShards.length) {
    fields.push("shard-count");
  }

  if (
    !equal(
      expectedShards.map((shard) => shard.path),
      actualShards.map((shard) => shard.path),
    )
  ) {
    fields.push("path");
  }

  if (
    !equal(
      expectedShards.map((shard) => shard.direction),
      actualShards.map((shard) => shard.direction),
    )
  ) {
    fields.push("direction");
  }

  return fields;
}

export function compareSectionSnapshots(
  expected: GlyphSectionSnapshot | undefined,
  actual: GlyphSectionSnapshot,
): GlyphChange[] {
  const expectedByChar = new Map(
    expected?.glyphs.map((glyph) => [glyph.char, glyph]) ?? [],
  );
  const actualByChar = new Map(actual.glyphs.map((glyph) => [glyph.char, glyph]));
  const chars = Array.from(
    new Set([
      ...actual.glyphs.map((glyph) => glyph.char),
      ...(expected?.glyphs.map((glyph) => glyph.char) ?? []),
    ]),
  );

  return chars.flatMap((char) => {
    const expectedGlyph = expectedByChar.get(char);
    const actualGlyph = actualByChar.get(char);

    if (!expectedGlyph && actualGlyph) {
      return [
        {
          char,
          codePoints: actualGlyph.codePoints,
          fields: ["missing-expected" as const],
        },
      ];
    }

    if (expectedGlyph && !actualGlyph) {
      return [
        {
          char,
          codePoints: expectedGlyph.codePoints,
          fields: ["missing-actual" as const],
        },
      ];
    }

    if (!expectedGlyph || !actualGlyph) return [];
    const fields = changedFields(expectedGlyph, actualGlyph);
    return fields.length === 0
      ? []
      : [{ char, codePoints: actualGlyph.codePoints, fields }];
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shardColor(index: number) {
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue} 68% 48%)`;
}

function renderedWidth(outline: TextOutline) {
  return outline.groups.reduce((sum, group) => sum + group.advance, 0);
}

function renderPaths(
  glyph: SnapshotGlyph,
  tileX: number,
  baseline: number,
  tileWidth: number,
  color: (index: number) => string,
  opacity: number,
) {
  const { outline } = glyph;
  const scale = 120 / outline.em;
  const width = renderedWidth(outline) * scale;
  const originX = tileX + (tileWidth - width) / 2;
  let glyphX = 0;
  let shardIndex = 0;
  const glyphPaths: string[] = [];

  for (const group of outline.groups) {
    for (const outlineGlyph of group.glyphs) {
      const paths: string[] = [];
      for (const shard of outlineGlyph.shards) {
        paths.push(
          `<path d="${escapeXml(shard.path)}" fill="${color(shardIndex)}" fill-opacity="${opacity}"/>`,
        );
        shardIndex += 1;
      }
      glyphPaths.push(
        `<g transform="translate(${glyphX} 0)">${paths.join("")}</g>`,
      );
      glyphX += outlineGlyph.advance;
    }
  }

  return `<g transform="translate(${originX} ${baseline}) scale(${scale})">${glyphPaths.join("")}</g>`;
}

function firstOutlineGlyph(glyph: SnapshotGlyph): ShardGlyph | undefined {
  return glyph.outline.groups.flatMap((group) => group.glyphs)[0];
}

function renderGuides(
  glyph: SnapshotGlyph,
  tileX: number,
  baseline: number,
  tileWidth: number,
) {
  const outlineGlyph = firstOutlineGlyph(glyph);
  const scale = 120 / glyph.outline.em;
  const width = renderedWidth(glyph.outline) * scale;
  const originX = tileX + (tileWidth - width) / 2;
  const baselineGuide = `<line data-guide="baseline" x1="${tileX + 12}" y1="${baseline}" x2="${tileX + tileWidth - 12}" y2="${baseline}"/>`;

  if (!outlineGlyph) return baselineGuide;
  const { bbox } = outlineGlyph;
  const bboxGuide = `<rect data-guide="bbox" x="${bbox.left}" y="${bbox.top}" width="${bbox.right - bbox.left}" height="${bbox.bottom - bbox.top}" transform="translate(${originX} ${baseline}) scale(${scale})"/>`;
  return `${baselineGuide}${bboxGuide}`;
}

type RenderAtlasOptions =
  | { mode: "snapshot" }
  | { mode: "diff"; expected?: GlyphSectionSnapshot };

export function renderSectionAtlas(
  snapshot: GlyphSectionSnapshot,
  options: RenderAtlasOptions,
) {
  const tileWidth = 180;
  const tileHeight = 190;
  const expectedByChar = new Map(
    options.mode === "diff"
      ? options.expected?.glyphs.map((glyph) => [glyph.char, glyph]) ?? []
      : [],
  );
  const actualByChar = new Map(snapshot.glyphs.map((glyph) => [glyph.char, glyph]));
  const glyphs =
    options.mode === "diff" && options.expected
      ? Array.from(
          new Set([
            ...snapshot.glyphs.map((glyph) => glyph.char),
            ...options.expected.glyphs.map((glyph) => glyph.char),
          ]),
        ).map((char) => actualByChar.get(char) ?? expectedByChar.get(char)!)
      : snapshot.glyphs;
  const columns = Math.min(8, Math.max(1, glyphs.length));
  const rows = Math.max(1, Math.ceil(glyphs.length / columns));
  const width = columns * tileWidth;
  const height = rows * tileHeight;

  const tiles = glyphs.map((glyph, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tileX = column * tileWidth;
    const tileY = row * tileHeight;
    const baseline = tileY + 155;
    const expectedGlyph = expectedByChar.get(glyph.char);
    const actualGlyph = actualByChar.get(glyph.char);
    const guideGlyph = actualGlyph ?? expectedGlyph ?? glyph;
    const paths =
      options.mode === "snapshot"
        ? renderPaths(
            glyph,
            tileX,
            baseline,
            tileWidth,
            shardColor,
            0.85,
          )
        : `${
            expectedGlyph
              ? renderPaths(
                  expectedGlyph,
                  tileX,
                  baseline,
                  tileWidth,
                  () => "#ef4444",
                  0.5,
                )
              : ""
          }${
            actualGlyph
              ? renderPaths(
                  actualGlyph,
                  tileX,
                  baseline,
                  tileWidth,
                  () => "#06b6d4",
                  0.5,
                )
              : ""
          }`;

    return `<g data-glyph="${escapeXml(glyph.char)}"><rect class="tile" x="${tileX + 1}" y="${tileY + 1}" width="${tileWidth - 2}" height="${tileHeight - 2}"/><text class="char" x="${tileX + 12}" y="${tileY + 22}">${escapeXml(glyph.char)}</text><text class="codepoint" x="${tileX + tileWidth - 12}" y="${tileY + 22}" text-anchor="end">${escapeXml(glyph.codePoints.join(" "))}</text>${renderGuides(guideGlyph, tileX, baseline, tileWidth)}${paths}</g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><style>svg{background:#fff;color:#111;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.tile{fill:#fafafa;stroke:#d4d4d8}.char{font-size:18px;font-weight:700;fill:#18181b}.codepoint{font-size:11px;fill:#71717a}[data-guide="baseline"]{stroke:#a1a1aa;stroke-dasharray:4 3}[data-guide="bbox"]{fill:none;stroke:#d4d4d8;stroke-dasharray:3 2;vector-effect:non-scaling-stroke}</style>${tiles.join("")}</svg>\n`;
}

function snapshotWithGlyph(
  snapshot: GlyphSectionSnapshot,
  glyph: SnapshotGlyph | undefined,
) {
  return { ...snapshot, glyphs: glyph ? [glyph] : [] };
}

function glyphFilename(codePoints: string[]) {
  return `${codePoints.map((value) => value.toLowerCase().replace("+", "")).join("-")}.diff.svg`;
}

function renderSummary(
  expected: GlyphSectionSnapshot | undefined,
  actual: GlyphSectionSnapshot,
  changes: GlyphChange[],
) {
  const lines = [
    `Section: ${actual.section.label} (${actual.section.id})`,
    `Changed glyphs: ${changes.length}`,
  ];

  if (!expected || !equal(expected.font, actual.font)) {
    lines.push("Font metadata changed");
  }

  for (const change of changes) {
    lines.push(
      `- ${change.char} (${change.codePoints.join(" ")}): ${change.fields.join(", ")}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function writeRegressionArtifacts({
  expected,
  actual,
  outputDir,
}: {
  expected?: GlyphSectionSnapshot;
  actual: GlyphSectionSnapshot;
  outputDir: string;
}) {
  const sectionDir = join(outputDir, actual.section.id);
  const glyphDir = join(sectionDir, "glyphs");
  const emptyExpected = { ...actual, glyphs: [] };
  const resolvedExpected = expected ?? emptyExpected;
  const changes = compareSectionSnapshots(expected, actual);
  const expectedByChar = new Map(
    expected?.glyphs.map((glyph) => [glyph.char, glyph]) ?? [],
  );
  const actualByChar = new Map(actual.glyphs.map((glyph) => [glyph.char, glyph]));

  await rm(sectionDir, { recursive: true, force: true });
  await mkdir(glyphDir, { recursive: true });
  await Promise.all([
    writeFile(
      join(sectionDir, "actual.json"),
      `${JSON.stringify(actual, null, 2)}\n`,
    ),
    writeFile(
      join(sectionDir, "expected.svg"),
      renderSectionAtlas(resolvedExpected, { mode: "snapshot" }),
    ),
    writeFile(
      join(sectionDir, "actual.svg"),
      renderSectionAtlas(actual, { mode: "snapshot" }),
    ),
    writeFile(
      join(sectionDir, "diff.svg"),
      renderSectionAtlas(actual, { mode: "diff", expected }),
    ),
    writeFile(
      join(sectionDir, "summary.txt"),
      renderSummary(expected, actual, changes),
    ),
    ...changes.map((change) => {
      const expectedGlyph = expectedByChar.get(change.char);
      const actualGlyph = actualByChar.get(change.char);
      const actualSnapshot = snapshotWithGlyph(actual, actualGlyph);
      const expectedSnapshot = snapshotWithGlyph(
        resolvedExpected,
        expectedGlyph,
      );
      return writeFile(
        join(glyphDir, glyphFilename(change.codePoints)),
        renderSectionAtlas(actualSnapshot, {
          mode: "diff",
          expected: expectedSnapshot,
        }),
      );
    }),
  ]);

  return sectionDir;
}

async function readExpectedSnapshot(snapshotPath: string) {
  try {
    return JSON.parse(
      await readFile(snapshotPath, "utf8"),
    ) as GlyphSectionSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function assertSectionFileSnapshot({
  actual,
  snapshotPath,
  outputDir,
  match,
}: {
  actual: GlyphSectionSnapshot;
  snapshotPath: string;
  outputDir: string;
  match: (json: string, snapshotPath: string) => Promise<void>;
}) {
  const json = `${JSON.stringify(actual, null, 2)}\n`;

  try {
    await match(json, snapshotPath);
  } catch (error) {
    const expected = await readExpectedSnapshot(snapshotPath);
    await writeRegressionArtifacts({ expected, actual, outputDir });
    throw error;
  }
}
