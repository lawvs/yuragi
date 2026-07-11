import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { FontAxes, TextOutline } from "@yuragi/core";
import { YuragiText } from "@yuragi/react/static";
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
import { createGlyphOutlineMap, type InspectorGlyph } from "./model";
import {
  ShardPreview,
  shardColor,
  type InspectorMode,
} from "./ShardPreview";

type InspectorStatus =
  | "loading"
  | "ready"
  | "compiling"
  | "idle"
  | "error";

type WorkerMessage =
  | { type: "wasm-ready"; wasmBytes: number; wasmLoadMs: number }
  | {
      type: "font-ready";
      fontBytes: number;
      fontLoadMs: number;
      unitsPerEm: number;
    }
  | {
      type: "compiled";
      requestId?: string;
      outline: TextOutline;
      compileMs: number;
      outlineBytes: number;
      wasmBytes: number;
      fontBytes: number;
    }
  | { type: "error"; message: string };

type PendingFont =
  | { type: "remote"; fontUrl: string }
  | { type: "local"; fontBytes: ArrayBuffer };

export function ShardInspector() {
  const defaultPreset = findFontPreset(DEFAULT_FONT_PRESET_ID);
  const workerRef = useRef<Worker | null>(null);
  const pendingFontRef = useRef<PendingFont>({
    type: "remote",
    fontUrl: defaultPreset.url,
  });
  const fontUrlRef = useRef(defaultPreset.url);
  const axesRef = useRef<FontAxes>(defaultPreset.axes);
  const catalogGlyphsRef = useRef(DEFAULT_GLYPHS);
  const fontReadyRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef("");
  const [presetId, setPresetId] = useState(DEFAULT_FONT_PRESET_ID);
  const [fontUrl, setFontUrl] = useState(defaultPreset.url);
  const [query, setQuery] = useState("");
  const [searchGlyphs, setSearchGlyphs] = useState<string[]>([]);
  const [selectedGlyph, setSelectedGlyph] = useState("a");
  const [selectedShard, setSelectedShard] = useState<number | null>(null);
  const [mode, setMode] = useState<InspectorMode>("assembled");
  const [explodeDistance, setExplodeDistance] = useState(80);
  const [glyphs, setGlyphs] = useState<Map<string, InspectorGlyph>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<InspectorStatus>("loading");
  const [error, setError] = useState("");
  const [compileMs, setCompileMs] = useState<number>();
  const selectedCodePoint = useMemo(
    () => selectedGlyph.codePointAt(0)?.toString(16).toUpperCase() ?? "",
    [selectedGlyph],
  );
  const selected = glyphs.get(selectedGlyph);

  function compileCatalog() {
    const requestId = `inspector-${++requestSequenceRef.current}`;
    activeRequestRef.current = requestId;
    setStatus("compiling");
    workerRef.current?.postMessage({
      type: "compile",
      requestId,
      text: catalogGlyphsRef.current.join(""),
      axes: axesRef.current,
    });
  }

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setError("Web Worker is not available in this browser.");
      setStatus("error");
      return;
    }

    const worker = new Worker(
      new URL("../wasm-lab/wasm-worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "wasm-ready") {
        const pendingFont = pendingFontRef.current;
        if (pendingFont.type === "local") {
          worker.postMessage(
            { type: "load-local-font", fontBytes: pendingFont.fontBytes },
            [pendingFont.fontBytes],
          );
        } else {
          worker.postMessage({
            type: "load-remote-font",
            fontUrl: pendingFont.fontUrl,
          });
        }
        return;
      }

      if (message.type === "font-ready") {
        fontReadyRef.current = true;
        compileCatalog();
        return;
      }

      if (message.type === "compiled") {
        if (message.requestId !== activeRequestRef.current) return;
        setGlyphs(createGlyphOutlineMap(message.outline));
        setCompileMs(message.compileMs);
        setStatus("ready");
        return;
      }

      setError(message.message);
      setStatus("error");
    });

    setStatus("loading");
    worker.postMessage({ type: "load-wasm", wasmUrl: DEFAULT_WASM_URL });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function selectPreset(id: string) {
    const preset = findFontPreset(id);
    setPresetId(preset.id);
    setFontUrl(preset.url);
    fontUrlRef.current = preset.url;
    axesRef.current = preset.axes;
    setGlyphs(new Map());
    fontReadyRef.current = false;
    activeRequestRef.current = "";
    setCompileMs(undefined);
    setError("");
    setStatus("idle");
  }

  function applyRemoteFont() {
    if (!fontUrlRef.current.trim()) return;
    setGlyphs(new Map());
    setCompileMs(undefined);
    setError("");
    setStatus("loading");
    fontReadyRef.current = false;
    activeRequestRef.current = "";
    pendingFontRef.current = {
      type: "remote",
      fontUrl: fontUrlRef.current,
    };
    workerRef.current?.postMessage({
      type: "load-wasm",
      wasmUrl: DEFAULT_WASM_URL,
    });
  }

  async function applyLocalFont(file: File | undefined) {
    if (!file) return;
    setGlyphs(new Map());
    setCompileMs(undefined);
    setError("");
    setStatus("loading");
    fontReadyRef.current = false;
    activeRequestRef.current = "";
    pendingFontRef.current = {
      type: "local",
      fontBytes: await file.arrayBuffer(),
    };
    workerRef.current?.postMessage({
      type: "load-wasm",
      wasmUrl: DEFAULT_WASM_URL,
    });
  }

  function addGlyphs(event: FormEvent) {
    event.preventDefault();
    const glyphs = parseGlyphQuery(query);
    if (glyphs.length === 0) return;
    const nextSearchGlyphs = mergeUniqueGlyphs(searchGlyphs, glyphs);
    setSearchGlyphs(nextSearchGlyphs);
    catalogGlyphsRef.current = mergeUniqueGlyphs(
      DEFAULT_GLYPHS,
      nextSearchGlyphs,
    );
    setSelectedGlyph(glyphs[0] ?? selectedGlyph);
    setSelectedShard(null);
    setQuery("");
    if (fontReadyRef.current) compileCatalog();
  }

  function selectGlyph(glyph: string) {
    setSelectedGlyph(glyph);
    setSelectedShard(null);
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
              onChange={(event) => {
                fontUrlRef.current = event.target.value;
                setFontUrl(event.target.value);
              }}
            />
          </label>
          <label className="inspector-file-control">
            <span>Local font</span>
            <input
              name="inspector-local-font"
              type="file"
              accept=".otf,.ttf,.woff,.woff2,font/*"
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
                selectedShard={selectedShard}
                onSelectShard={setSelectedShard}
              />
            ) : (
              <span>{selectedGlyph}</span>
            )}
          </div>
          {selected ? (
            <dl className="glyph-summary">
              <div>
                <dt>Shards</dt>
                <dd>{selected.glyph.shards.length} shards</dd>
              </div>
              <div>
                <dt>Advance</dt>
                <dd>{selected.glyph.advance}</dd>
              </div>
            </dl>
          ) : null}
          {selected ? (
            <div className="shard-parts" aria-label="Glyph shards">
              <div className="shard-parts-heading">
                <h4>Parts</h4>
                <span>{selected.glyph.shards.length}</span>
              </div>
              <div className="shard-parts-list">
                {selected.glyph.shards.map((shard, index) => (
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
            {status === "ready"
              ? `Compiled ${glyphs.size} glyphs in ${compileMs?.toFixed(1) ?? "0.0"} ms.`
              : status === "idle"
                ? "Apply the selected font to rebuild the atlas."
                : status === "error"
                  ? error
                  : status}
          </p>
        </aside>
      </div>
    </section>
  );
}

type GlyphSectionProps = {
  id: string;
  label: string;
  glyphs: readonly string[];
  selectedGlyph: string;
  glyphMap: Map<string, InspectorGlyph>;
  onSelect: (glyph: string) => void;
};

function GlyphSection({
  id,
  label,
  glyphs,
  selectedGlyph,
  glyphMap,
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
  selected,
  onSelect,
}: {
  glyph: string;
  data?: InspectorGlyph;
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
          />
        ) : (
          glyph
        )}
      </span>
      <span className="glyph-tile-label">{glyph}</span>
      <span data-shard-count>{data?.glyph.shards.length ?? "-"}</span>
    </button>
  );
}
