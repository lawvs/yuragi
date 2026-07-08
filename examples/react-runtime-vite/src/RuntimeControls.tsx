type RuntimeControlsProps = {
  title: string;
  onTitleChange: (title: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  hoverOutline: boolean;
  onHoverOutlineChange: (enabled: boolean) => void;
  sharedMotion: boolean;
  onSharedMotionChange: (enabled: boolean) => void;
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
  sharedMotion,
  onSharedMotionChange,
  presets,
}: RuntimeControlsProps) {
  return (
    <section className="controls" aria-label="Runtime controls">
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

      <label className="toggle">
        <input
          type="checkbox"
          checked={sharedMotion}
          onChange={(event) => onSharedMotionChange(event.target.checked)}
        />
        <span>Shared motion</span>
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
