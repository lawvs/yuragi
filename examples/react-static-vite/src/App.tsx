import { useState } from "react";
import {
  YuragiStyles,
  YuragiText,
  type StaticYuragiTextProps,
} from "@yuragi/react/static";
import generatedOutlines from "./generated/outlines.json";
import titles from "./titles.json";

type OutlineMap = Readonly<
  Partial<
    Record<string, NonNullable<StaticYuragiTextProps["outline"]>>
  >
>;

const outlines = generatedOutlines as unknown as OutlineMap;

type StaticControlsProps = {
  title: string;
  size: number;
  speed: number;
  hoverOutline: boolean;
  onTitleChange: (title: string) => void;
  onSizeChange: (size: number) => void;
  onSpeedChange: (speed: number) => void;
  onHoverOutlineChange: (enabled: boolean) => void;
};

function StaticControls({
  title,
  size,
  speed,
  hoverOutline,
  onTitleChange,
  onSizeChange,
  onSpeedChange,
  onHoverOutlineChange,
}: StaticControlsProps) {
  return (
    <aside className="controls" aria-label="Static title controls">
      <div className="presets" role="group" aria-label="Compiled titles">
        {titles.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={title === preset}
            onClick={() => onTitleChange(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Size</span>
        <input
          type="range"
          min="48"
          max="140"
          step="2"
          value={size}
          onChange={(event) => onSizeChange(Number(event.target.value))}
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
          onChange={(event) => onSpeedChange(Number(event.target.value))}
        />
        <output>{speed.toFixed(2)}x</output>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={hoverOutline}
          onChange={(event) =>
            onHoverOutlineChange(event.target.checked)
          }
        />
        <span>Hover outline</span>
      </label>
    </aside>
  );
}

export function App() {
  const [title, setTitle] = useState(titles[0] ?? "");
  const [size, setSize] = useState(88);
  const [speed, setSpeed] = useState(1);
  const [hoverOutline, setHoverOutline] = useState(true);

  return (
    <>
      <YuragiStyles />
      <main className="example-shell">
        <StaticControls
          title={title}
          size={size}
          speed={speed}
          hoverOutline={hoverOutline}
          onTitleChange={setTitle}
          onSizeChange={setSize}
          onSpeedChange={setSpeed}
          onHoverOutlineChange={setHoverOutline}
        />

        <section className="preview" aria-label="Static outline preview">
          <YuragiText
            text={title}
            outline={outlines[title]}
            size={size}
            maxWidth={860}
            align="start"
            fallback="error"
            hover={hoverOutline ? "outline" : "none"}
            transition={{ enter: "settle", exit: "scatter", speed }}
          />
        </section>
      </main>
    </>
  );
}
