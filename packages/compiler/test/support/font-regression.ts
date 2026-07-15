import type {
  FontAxes,
  TextOutline,
  TextOutlineBundle,
} from "@yuragi-labs/core";

export type SnapshotGlyphSection = {
  id: string;
  label: string;
  glyphs: readonly string[];
};

export type GlyphSectionSnapshot = {
  schemaVersion: 1;
  font: {
    sha256: string;
    axes: FontAxes;
    unitsPerEm: number;
  };
  section: {
    id: string;
    label: string;
  };
  glyphs: Array<{
    char: string;
    codePoints: string[];
    outline: TextOutline;
  }>;
};

function codePoints(value: string) {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      throw new Error(`Cannot read code point for ${JSON.stringify(value)}`);
    }

    return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
  });
}

export function createSectionSnapshot(
  section: SnapshotGlyphSection,
  bundle: TextOutlineBundle,
  axes: FontAxes,
): GlyphSectionSnapshot {
  return {
    schemaVersion: 1,
    font: {
      sha256: bundle.font.hash,
      axes,
      unitsPerEm: bundle.font.unitsPerEm,
    },
    section: {
      id: section.id,
      label: section.label,
    },
    glyphs: section.glyphs.map((char) => {
      const outline = bundle.outlines[char];
      if (!outline) {
        throw new Error(`Missing compiled outline for ${JSON.stringify(char)}`);
      }

      return {
        char,
        codePoints: codePoints(char),
        outline,
      };
    }),
  };
}

export {
  assertSectionFileSnapshot,
  compareSectionSnapshots,
  renderSectionAtlas,
  writeRegressionArtifacts,
  type GlyphChange,
  type GlyphChangeField,
} from "./font-regression-artifacts";
