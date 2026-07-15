import { useYuragiFont } from "@yuragi-labs/react";

type RuntimeControlsProps = {
  title: string;
  onTitleChange: (title: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  hoverOutline: boolean;
  onHoverOutlineChange: (enabled: boolean) => void;
  presets: readonly string[];
};

export function RuntimeControls({
  title,
  onTitleChange,
  size,
  onSizeChange,
  speed,
  onSpeedChange,
  hoverOutline,
  onHoverOutlineChange,
  presets,
}: RuntimeControlsProps) {
  const fontState = useYuragiFont();
  const fontStatusText =
    fontState.status === "ready"
      ? "Font ready"
      : fontState.status === "error"
        ? "Font error"
        : "Loading font";

  return (
    <section className="controls" aria-label="Runtime controls">
      <p className="font-status" data-status={fontState.status}>
        {fontStatusText}
      </p>

      <label className="field">
        <span>Title</span>
        <input
          name="title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
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
          onChange={(event) => onHoverOutlineChange(event.target.checked)}
        />
        <span>Hover outline</span>
      </label>

      <div className="presets" aria-label="Preset titles">
        {presets.map((preset) => (
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
    </section>
  );
}
