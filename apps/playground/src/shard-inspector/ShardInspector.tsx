import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { FontAxes, TextOutline } from "@yuragi/core";
import { YuragiText } from "@yuragi/react/static";
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
import { createInspectorGlyph, type InspectorGlyph } from "./model";
import {
  ShardPreview,
  shardColor,
  type InspectorMode,
  type InspectorPlayback,
} from "./ShardPreview";

type InspectorStatus =
  | "loading-wasm"
  | "loading-font"
  | "ready"
  | "compiling"
  | "idle"
  | "error";

type WorkerMessage =
  | { type: "wasm-ready" }
  | {
      type: "font-ready";
      loadId?: string;
    }
  | {
      type: "glyphs-compiled";
      requestId: string;
      results: Array<{
        glyph: string;
        outline?: TextOutline;
      }>;
      compileMs: number;
    }
  | { type: "error"; message: string; loadId?: string };

type PendingFont =
  | { type: "remote"; fontUrl: string }
  | { type: "local"; fontBytes: ArrayBuffer };

export function ShardInspector() {
  const defaultPreset = findFontPreset(DEFAULT_FONT_PRESET_ID);
  const workerRef = useRef<Worker | null>(null);
  const pendingFontRef = useRef<PendingFont | null>({
    type: "remote",
    fontUrl: defaultPreset.url,
  });
  const fontUrlRef = useRef(defaultPreset.url);
  const axesRef = useRef<FontAxes>(defaultPreset.axes);
  const catalogGlyphsRef = useRef(DEFAULT_GLYPHS);
  const fontReadyRef = useRef(false);
  const wasmReadyRef = useRef(false);
  const fontIntentSequenceRef = useRef(0);
  const fontLoadSequenceRef = useRef(0);
  const activeFontLoadRef = useRef("");
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
  const [missingGlyphs, setMissingGlyphs] = useState<Set<string>>(
    () => new Set(),
  );
  const [playback, setPlayback] = useState<InspectorPlayback | null>(null);
  const [status, setStatus] = useState<InspectorStatus>("loading-wasm");
  const [error, setError] = useState("");
  const [compileMs, setCompileMs] = useState<number>();
  const selectedCodePoint =
    selectedGlyph.codePointAt(0)?.toString(16).toUpperCase() ?? "";
  const selected = glyphs.get(selectedGlyph);
  const selectedMissing = missingGlyphs.has(selectedGlyph);

  function compileCatalog() {
    const requestId = `inspector-${++requestSequenceRef.current}`;
    activeRequestRef.current = requestId;
    setStatus("compiling");
    workerRef.current?.postMessage({
      type: "compile-glyphs",
      requestId,
      glyphs: catalogGlyphsRef.current,
      axes: axesRef.current,
    });
  }

  function loadPendingFont(worker: Worker) {
    const pendingFont = pendingFontRef.current;
    if (!pendingFont) return;
    pendingFontRef.current = null;

    const loadId = `inspector-font-${++fontLoadSequenceRef.current}`;
    activeFontLoadRef.current = loadId;

    if (pendingFont.type === "local") {
      worker.postMessage(
        {
          type: "load-local-font",
          loadId,
          fontBytes: pendingFont.fontBytes,
        },
        [pendingFont.fontBytes],
      );
      return;
    }

    worker.postMessage({
      type: "load-remote-font",
      loadId,
      fontUrl: pendingFont.fontUrl,
    });
  }

  function resetFontState(nextStatus: InspectorStatus) {
    setGlyphs(new Map());
    setMissingGlyphs(new Set());
    setSelectedShard(null);
    setCompileMs(undefined);
    setError("");
    setStatus(nextStatus);
    fontReadyRef.current = false;
    activeRequestRef.current = "";
    activeFontLoadRef.current = "";
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
        wasmReadyRef.current = true;
        if (pendingFontRef.current) {
          setStatus("loading-font");
          loadPendingFont(worker);
        }
        return;
      }

      if (message.type === "font-ready") {
        if (message.loadId !== activeFontLoadRef.current) return;
        fontReadyRef.current = true;
        compileCatalog();
        return;
      }

      if (message.type === "glyphs-compiled") {
        if (message.requestId !== activeRequestRef.current) return;
        const nextGlyphs = new Map<string, InspectorGlyph>();

        for (const result of message.results) {
          if (!result.outline) continue;
          const data = createInspectorGlyph(result.glyph, result.outline);
          if (data) nextGlyphs.set(result.glyph, data);
        }

        setGlyphs(nextGlyphs);
        setMissingGlyphs(
          new Set(
            catalogGlyphsRef.current.filter(
              (glyph) => !nextGlyphs.has(glyph),
            ),
          ),
        );
        setCompileMs(message.compileMs);
        setStatus("ready");
        return;
      }

      if (
        message.loadId !== undefined &&
        message.loadId !== activeFontLoadRef.current
      ) {
        return;
      }
      setError(message.message);
      setStatus("error");
    });

    setStatus("loading-wasm");
    worker.postMessage({ type: "load-wasm", wasmUrl: DEFAULT_WASM_URL });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  function selectPreset(id: string) {
    const preset = findFontPreset(id);
    fontIntentSequenceRef.current += 1;
    pendingFontRef.current = null;
    setPresetId(preset.id);
    setFontUrl(preset.url);
    fontUrlRef.current = preset.url;
    axesRef.current = preset.axes;
    resetFontState("idle");
  }

  function applyRemoteFont() {
    if (!fontUrlRef.current.trim()) return;
    fontIntentSequenceRef.current += 1;
    pendingFontRef.current = {
      type: "remote",
      fontUrl: fontUrlRef.current,
    };
    resetFontState(wasmReadyRef.current ? "loading-font" : "loading-wasm");
    const worker = workerRef.current;
    if (worker && wasmReadyRef.current) loadPendingFont(worker);
  }

  async function applyLocalFont(file: File | undefined) {
    if (!file) return;
    const intent = ++fontIntentSequenceRef.current;
    pendingFontRef.current = null;
    resetFontState(wasmReadyRef.current ? "loading-font" : "loading-wasm");
    const fontBytes = await file.arrayBuffer();
    if (intent !== fontIntentSequenceRef.current) return;

    pendingFontRef.current = {
      type: "local",
      fontBytes,
    };
    const worker = workerRef.current;
    if (worker && wasmReadyRef.current) {
      setStatus("loading-font");
      loadPendingFont(worker);
    }
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
              catalogGlyphsRef.current.length,
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
