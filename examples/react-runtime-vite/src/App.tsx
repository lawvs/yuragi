import { useState } from "react";
import { YuragiFontProvider, YuragiText } from "@yuragi/react";

const FONT_URL =
  "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/OTF/SourceHanSerifSC-VF.otf";
const AXES = { wght: 900 };
const PRESETS = ["Dashboard", "Settings", "揺らぎ", "Live Runtime Title"];

export function App() {
  const [title, setTitle] = useState(PRESETS[0]);
  const [size, setSize] = useState(88);
  const [speed, setSpeed] = useState(1);
  const [hoverOutline, setHoverOutline] = useState(true);
  const [sharedMotion, setSharedMotion] = useState(true);

  return (
    <YuragiFontProvider font={FONT_URL} axes={AXES}>
      <main className="example-shell">
        <section className="controls" aria-label="Runtime controls">
          <label className="field">
            <span>Title</span>
            <input
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Size</span>
            <input
              type="range"
              min="48"
              max="144"
              step="2"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
            <output>{size}px</output>
          </label>

          <label className="field">
            <span>Speed</span>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <output>{speed.toFixed(2)}x</output>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={hoverOutline}
              onChange={(event) => setHoverOutline(event.target.checked)}
            />
            <span>Hover outline</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={sharedMotion}
              onChange={(event) => setSharedMotion(event.target.checked)}
            />
            <span>Shared motion</span>
          </label>

          <div className="presets" aria-label="Preset titles">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={title === preset}
                onClick={() => setTitle(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </section>

        <section className="preview" aria-label="Runtime preview">
          <YuragiText
            text={title}
            sharedId={sharedMotion ? "example:title" : false}
            size={size}
            maxWidth={860}
            align="start"
            fallback="text"
            hover={hoverOutline ? "outline" : "none"}
            transition={{
              enter: "settle",
              exit: "scatter",
              speed,
            }}
          />
        </section>
      </main>
    </YuragiFontProvider>
  );
}
