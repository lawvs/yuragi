import { useEffect, useRef, useState } from "react";
import { outlineToSvgPath } from "@yuragi-labs/core";
import type { YuragiFont } from "@yuragi-labs/core/wasm";
import { useYuragiFont } from "@yuragi-labs/react";
import { fitIcon, SPRING_PRESETS, Spring } from "morphicons";
import { MorphIcon } from "morphicons/react";
import "./MorphLab.css";

const INITIAL_TEXT = "A";

type MorphTarget = {
  icon: string;
  text: string;
};

type MorphPair = {
  previous: MorphTarget;
  current: MorphTarget;
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
  const [pair, setPair] = useState<MorphPair>(() => {
    const initial = compileTarget(font, INITIAL_TEXT);
    return { previous: initial, current: initial };
  });
  const [progress, setProgress] = useState(1);
  const [error, setError] = useState<string>();
  const animationFrame = useRef<number | null>(null);

  function stopAnimation() {
    if (animationFrame.current === null) return;
    cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
  }

  useEffect(
    () => () => {
      stopAnimation();
    },
    [],
  );

  function playMorph() {
    stopAnimation();
    if (
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setProgress(1);
      return;
    }

    const spring = new Spring();
    spring.config(SPRING_PRESETS.snappy.k, SPRING_PRESETS.snappy.c);
    spring.start();
    let previousTime = performance.now();
    setProgress(0);

    function tick(time: number) {
      const delta = Math.min(Math.max((time - previousTime) / 1_000, 0), 0.1);
      previousTime = time;
      const settled = spring.step(delta);
      setProgress(
        settled ? 1 : Math.min(1, Math.max(0, spring.x)),
      );
      animationFrame.current = settled
        ? null
        : requestAnimationFrame(tick);
    }

    animationFrame.current = requestAnimationFrame(tick);
  }

  function morph() {
    if (!text) {
      setError("Enter at least one visible character");
      return;
    }

    try {
      const next = compileTarget(font, text);
      setPair(({ current }) => ({ previous: current, current: next }));
      playMorph();
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
          Submit text to compile a new font outline, then scrub between the
          previous and current shapes.
        </p>
        {error ? (
          <p className="morph-lab-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <div className="morph-lab-preview">
        <div className="morph-lab-stage">
          <MorphIcon
            className="morph-lab-icon"
            from={pair.previous.icon}
            to={pair.current.icon}
            progress={progress}
            label={pair.current.text}
            size={360}
            fill="currentColor"
            stroke="none"
          />
        </div>
        <label className="morph-lab-scrub">
          <input
            type="range"
            name="morph-progress"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            aria-label="Scrub the morph between the previous and current text"
            onChange={(event) => {
              stopAnimation();
              setProgress(Number(event.target.value));
            }}
          />
          <output>t={progress.toFixed(2)}</output>
        </label>
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
