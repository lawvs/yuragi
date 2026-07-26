import { useState, type FormEvent } from "react";
import { YuragiText } from "@yuragi-labs/react/static";
import "./ShardInspector.css";
import {
  DEFAULT_FONT_PRESET_ID,
  DEFAULT_WASM_URL,
  FONT_PRESETS,
  findFontPreset,
} from "../font-presets";
import {
  DEFAULT_GLYPHS,
  DEFAULT_GLYPH_SECTIONS,
  mergeUniqueGlyphs,
  parseGlyphQuery,
} from "./catalog";
import type { InspectorGlyph } from "./model";
import {
  ShardPreview,
  shardColor,
  type InspectorMode,
  type InspectorPlayback,
} from "./ShardPreview";
import {
  useShardInspectorCompiler,
  type InspectorStatus,
} from "./useShardInspectorCompiler";

export function ShardInspector() {
  const defaultPreset = findFontPreset(DEFAULT_FONT_PRESET_ID);
  const [presetId, setPresetId] = useState(DEFAULT_FONT_PRESET_ID);
  const [fontUrl, setFontUrl] = useState(defaultPreset.url);
  const [query, setQuery] = useState("");
  const [searchGlyphs, setSearchGlyphs] = useState<string[]>([]);
  const [selectedGlyph, setSelectedGlyph] = useState("a");
  const [selectedShard, setSelectedShard] = useState<number | null>(null);
  const [mode, setMode] = useState<InspectorMode>("assembled");
  const [explodeDistance, setExplodeDistance] = useState(80);
  const [playback, setPlayback] = useState<InspectorPlayback | null>(null);
  const selectedPreset = findFontPreset(presetId);
  const catalogGlyphs = mergeUniqueGlyphs(DEFAULT_GLYPHS, searchGlyphs);
  const {
    applyLocalFont: applyLocalFontToCompiler,
    applyRemoteFont: applyRemoteFontToCompiler,
    compileGlyphs,
    compileMs,
    error,
    glyphs,
    missingGlyphs,
    ready,
    resetFont,
    status,
  } = useShardInspectorCompiler({
    wasmUrl: DEFAULT_WASM_URL,
    initialFont: {
      type: "remote",
      fontUrl: defaultPreset.url,
    },
    initialAxes: defaultPreset.axes,
    initialGlyphs: DEFAULT_GLYPHS,
  });
  const selectedCodePoint =
    selectedGlyph.codePointAt(0)?.toString(16).toUpperCase() ?? "";
  const selected = glyphs.get(selectedGlyph);
  const selectedMissing = missingGlyphs.has(selectedGlyph);

  function selectPreset(id: string) {
    const preset = findFontPreset(id);
    setPresetId(preset.id);
    setFontUrl(preset.url);
    setSelectedShard(null);
    resetFont();
  }

  function applyRemoteFont() {
    if (!fontUrl.trim()) return;
    setSelectedShard(null);
    applyRemoteFontToCompiler({
      fontUrl,
      axes: selectedPreset.axes,
      glyphs: catalogGlyphs,
    });
  }

  async function applyLocalFont(file: File | undefined) {
    if (!file) return;
    setSelectedShard(null);
    await applyLocalFontToCompiler({
      file,
      axes: selectedPreset.axes,
      glyphs: catalogGlyphs,
    });
  }

  function addGlyphs(event: FormEvent) {
    event.preventDefault();
    const glyphs = parseGlyphQuery(query);
    if (glyphs.length === 0) return;
    const nextSearchGlyphs = mergeUniqueGlyphs(searchGlyphs, glyphs);
    const nextCatalogGlyphs = mergeUniqueGlyphs(
      DEFAULT_GLYPHS,
      nextSearchGlyphs,
    );
    setSearchGlyphs(nextSearchGlyphs);
    setSelectedGlyph(glyphs[0] ?? selectedGlyph);
    setSelectedShard(null);
    setQuery("");
    if (ready) {
      compileGlyphs({
        glyphs: nextCatalogGlyphs,
        axes: selectedPreset.axes,
      });
    }
  }

  function selectGlyph(glyph: string) {
    setSelectedGlyph(glyph);
    setSelectedShard(null);
  }

  function play(type: InspectorPlayback["type"]) {
    setMode("assembled");
    setPlayback({
      type,
      distance: explodeDistance,
    });
  }

  return (
    <section className="shard-inspector" aria-label="Shard Inspector">
      <header className="inspector-header">
        <div>
          <p className="eyebrow">glyph development</p>
          <h2>Shard Inspector</h2>
        </div>
        <div className="inspector-font-controls">
          <label>
            <span>Font</span>
            <select
              name="inspector-font-preset"
              value={presetId}
              onChange={(event) => selectPreset(event.target.value)}
            >
              {FONT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inspector-font-url">
            <span>Font URL</span>
            <input
              name="inspector-font-url"
              value={fontUrl}
              readOnly={presetId !== "custom"}
              onChange={(event) => setFontUrl(event.target.value)}
            />
          </label>
          <label className="inspector-file-control">
            <span>Local font</span>
            <input
              name="inspector-local-font"
              type="file"
              accept=".otf,.ttf,font/otf,font/ttf"
              onChange={(event) => {
                void applyLocalFont(event.target.files?.[0]);
              }}
            />
          </label>
          <button
            type="button"
            onClick={applyRemoteFont}
            disabled={!fontUrl.trim()}
          >
            Apply font
          </button>
        </div>
      </header>

      <form className="glyph-search" onSubmit={addGlyphs}>
        <label>
          <span>Find or add glyph</span>
          <input
            name="glyph-search"
            value={query}
            placeholder="字, あ, or U+5B57"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit" data-action="add-glyphs">
          Add glyphs
        </button>
      </form>

      <div className="inspector-layout">
        <div className="glyph-atlas" aria-label="Glyph atlas">
          {searchGlyphs.length > 0 ? (
            <GlyphSection
              id="search"
              label="Search Results"
              glyphs={searchGlyphs}
              selectedGlyph={selectedGlyph}
              glyphMap={glyphs}
              missingGlyphs={missingGlyphs}
              onSelect={selectGlyph}
            />
          ) : null}
          {DEFAULT_GLYPH_SECTIONS.map((section) => (
            <GlyphSection
              key={section.id}
              id={section.id}
              label={section.label}
              glyphs={section.glyphs}
              selectedGlyph={selectedGlyph}
              glyphMap={glyphs}
              missingGlyphs={missingGlyphs}
              onSelect={selectGlyph}
            />
          ))}
        </div>

        <aside className="glyph-detail" aria-label="Selected glyph details">
          <div className="glyph-detail-heading">
            <span className="glyph-detail-character">{selectedGlyph}</span>
            <div>
              <h3>{selectedGlyph}</h3>
              <p>U+{selectedCodePoint.padStart(4, "0")}</p>
            </div>
          </div>
          <div className="inspector-mode-controls" aria-label="Preview mode">
            {(["assembled", "colored", "exploded"] as const).map(
              (option) => (
                <button
                  key={option}
                  type="button"
                  data-mode={option}
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                >
                  {option[0]?.toUpperCase()}
                  {option.slice(1)}
                </button>
              ),
            )}
          </div>
          <label className="explode-control">
            <span>Explode</span>
            <input
              name="explode-distance"
              type="range"
              min="0"
              max="160"
              step="4"
              value={explodeDistance}
              onChange={(event) =>
                setExplodeDistance(Number(event.target.value))
              }
            />
            <output>{explodeDistance}px</output>
          </label>
          <div className="glyph-detail-preview" aria-label="Glyph preview">
            {selected ? (
              <ShardPreview
                data={selected}
                mode={mode}
                explodeDistance={explodeDistance}
                playback={playback}
                selectedShard={selectedShard}
                onPlay={play}
                onSelectShard={setSelectedShard}
              />
            ) : selectedMissing ? (
              <span className="glyph-missing">Missing glyph</span>
            ) : (
              <span>{selectedGlyph}</span>
            )}
          </div>
          {selected ? (
            <dl className="glyph-summary">
              <div>
                <dt>Shards</dt>
                <dd>{selected.shards.length} shards</dd>
              </div>
              <div>
                <dt>Advance</dt>
                <dd>{selected.advance}</dd>
              </div>
            </dl>
          ) : null}
          {selected ? (
            <div className="shard-parts" aria-label="Glyph shards">
              <div className="shard-parts-heading">
                <h4>Parts</h4>
                <span>{selected.shards.length}</span>
              </div>
              <div className="shard-parts-list">
                {selected.shards.map((shard, index) => (
                  <button
                    key={`${index}-${shard.path}`}
                    type="button"
                    data-shard-index={index}
                    aria-pressed={selectedShard === index}
                    onClick={() => setSelectedShard(index)}
                  >
                    <span
                      className="shard-swatch"
                      style={{ backgroundColor: shardColor(index) }}
                    />
                    <strong>#{index + 1}</strong>
                    <span>
                      {shard.direction[0].toFixed(2)}, {shard.direction[1].toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <p className="inspector-status" data-status={status}>
            {inspectorStatusText(
              status,
              glyphs.size,
              catalogGlyphs.length,
              compileMs,
              error,
            )}
          </p>
        </aside>
      </div>
    </section>
  );
}

function inspectorStatusText(
  status: InspectorStatus,
  compiledGlyphs: number,
  totalGlyphs: number,
  compileMs: number | undefined,
  error: string,
) {
  switch (status) {
    case "loading-wasm":
      return "Loading WASM...";
    case "loading-font":
      return "Loading font...";
    case "compiling":
      return "Compiling glyphs...";
    case "ready":
      return `Compiled ${compiledGlyphs} of ${totalGlyphs} glyphs in ${compileMs?.toFixed(1) ?? "0.0"} ms.`;
    case "idle":
      return "Apply the selected font to rebuild the atlas.";
    case "error":
      return error;
  }
}

type GlyphSectionProps = {
  id: string;
  label: string;
  glyphs: readonly string[];
  selectedGlyph: string;
  glyphMap: Map<string, InspectorGlyph>;
  missingGlyphs: Set<string>;
  onSelect: (glyph: string) => void;
};

function GlyphSection({
  id,
  label,
  glyphs,
  selectedGlyph,
  glyphMap,
  missingGlyphs,
  onSelect,
}: GlyphSectionProps) {
  return (
    <section className="glyph-section" aria-labelledby={`glyph-section-${id}`}>
      <div className="glyph-section-heading">
        <h3 id={`glyph-section-${id}`}>{label}</h3>
        <span>{glyphs.length}</span>
      </div>
      <div className="glyph-grid">
        {glyphs.map((glyph) => (
          <GlyphTile
            key={glyph}
            glyph={glyph}
            data={glyphMap.get(glyph)}
            missing={missingGlyphs.has(glyph)}
            selected={glyph === selectedGlyph}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function GlyphTile({
  glyph,
  data,
  missing,
  selected,
  onSelect,
}: {
  glyph: string;
  data?: InspectorGlyph;
  missing: boolean;
  selected: boolean;
  onSelect: (glyph: string) => void;
}) {
  return (
    <button
      type="button"
      className="glyph-tile"
      data-glyph={glyph}
      aria-pressed={selected}
      onClick={() => onSelect(glyph)}
    >
      <span className="glyph-tile-preview">
        {data ? (
          <YuragiText
            text={glyph}
            outline={data.outline}
            size={42}
            maxWidth={56}
            fallback="hidden"
            animation={{ exit: false }}
          />
        ) : (
          glyph
        )}
      </span>
      <span className="glyph-tile-label">{glyph}</span>
      <span data-shard-count>
        {missing ? "Missing" : (data?.shards.length ?? "-")}
      </span>
    </button>
  );
}
