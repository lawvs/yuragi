import { useYuragiFont } from "@yuragi-labs/react";

type RuntimeControlsProps = {
  title: string;
  onTitleChange: (value: string) => void;
  size: number;
  onSizeChange: (value: number) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  hoverOutline: boolean;
  onHoverOutlineChange: (value: boolean) => void;
  hoverMotion: boolean;
  onHoverMotionChange: (value: boolean) => void;
};

export function RuntimeControls(props: RuntimeControlsProps) {
  return (
    <section className="runtime-controls" aria-label="Text controls">
      <RuntimeFontStatus />

      <label className="runtime-control-title">
        <span>Text</span>
        <input
          aria-label="Title text"
          name="runtime-title"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.target.value)}
        />
      </label>

      <div className="runtime-control-grid">
        <label className="runtime-control-range">
          <span>Size</span>
          <input
            aria-label="Title size"
            type="range"
            min="48"
            max="140"
            step="2"
            value={props.size}
            onChange={(event) =>
              props.onSizeChange(Number(event.target.value))
            }
          />
          <output>{props.size} px</output>
        </label>

        <label className="runtime-control-range">
          <span>Speed</span>
          <input
            aria-label="Animation speed"
            type="range"
            name="animation-speed"
            min="0.25"
            max="2"
            step="0.05"
            value={props.speed}
            onChange={(event) =>
              props.onSpeedChange(Number(event.target.value))
            }
          />
          <output>{props.speed.toFixed(2)}×</output>
        </label>

        <label className="runtime-control-check">
          <span>Outline</span>
          <input
            type="checkbox"
            name="hover"
            checked={props.hoverOutline}
            onChange={(event) =>
              props.onHoverOutlineChange(event.target.checked)
            }
          />
          <b>{props.hoverOutline ? "ON" : "OFF"}</b>
        </label>

        <label className="runtime-control-check">
          <span>Motion</span>
          <input
            type="checkbox"
            name="hover-motion"
            checked={props.hoverMotion}
            onChange={(event) =>
              props.onHoverMotionChange(event.target.checked)
            }
          />
          <b>{props.hoverMotion ? "ON" : "OFF"}</b>
        </label>
      </div>
    </section>
  );
}

function RuntimeFontStatus() {
  const fontState = useYuragiFont();
  if (fontState.status !== "loading") return null;

  return (
    <span className="font-status" role="status" aria-live="polite">
      <span className="font-status-spinner" aria-hidden="true" />
      Preparing demo…
    </span>
  );
}
