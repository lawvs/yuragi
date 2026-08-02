import { useState } from "react";
import { outlineToSvgPath } from "@yuragi-labs/core";
import type { YuragiFont } from "@yuragi-labs/core/wasm";
import { useYuragiFont } from "@yuragi-labs/react";
import { fitIcon } from "morphicons";
import { MorphIcon } from "morphicons/react";
import "./MorphLab.css";

const INITIAL_TEXT = "A";

type MorphTarget = {
  icon: string;
  text: string;
};

function compileTarget(font: YuragiFont, text: string): MorphTarget {
  const outline = font.compile(text);
  const path = outlineToSvgPath(outline, { size: outline.em });
  if (!path.d || path.viewBox[2] <= 0 || path.viewBox[3] <= 0) {
    throw new Error("The text does not contain a visible outline");
  }
  return {
    icon: fitIcon(path.d, path.viewBox),
    text,
  };
}

function MorphExperiment({ font }: { font: YuragiFont }) {
  const [text, setText] = useState(INITIAL_TEXT);
  const [target, setTarget] = useState(() =>
    compileTarget(font, INITIAL_TEXT),
  );
  const [error, setError] = useState<string>();

  function morph() {
    if (!text) {
      setError("Enter at least one visible character");
      return;
    }

    try {
      setTarget(compileTarget(font, text));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="morph-lab-grid">
      <form
        className="morph-lab-controls"
        onSubmit={(event) => {
          event.preventDefault();
          morph();
        }}
      >
        <label>
          <span>Text</span>
          <input
            name="morph-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button type="submit">Morph</button>
        <p>
          Submit text to compile a new font outline. Morphicons retargets the
          current shape without restarting from the previous endpoint.
        </p>
        {error ? (
          <p className="morph-lab-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <div className="morph-lab-stage">
        <MorphIcon
          className="morph-lab-icon"
          icon={target.icon}
          label={target.text}
          size={360}
          spring="snappy"
          strokeWidth={0.7}
        />
      </div>
    </div>
  );
}

export function MorphLab() {
  const fontState = useYuragiFont();

  return (
    <section className="morph-lab" aria-label="Morphicons experiment">
      <header className="morph-lab-header">
        <div>
          <p className="eyebrow">experimental integration</p>
          <h2>Morph Lab</h2>
        </div>
        <a href="https://github.com/guillermolg00/morphicons">
          Morphicons
        </a>
      </header>

      {fontState.status === "ready" ? (
        <MorphExperiment font={fontState.font} />
      ) : (
        <p className="morph-lab-status" role="status">
          {fontState.status === "error"
            ? `Font failed to load: ${fontState.error.message}`
            : "Preparing font…"}
        </p>
      )}
    </section>
  );
}
