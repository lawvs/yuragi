import { useState } from "react";
import type { TextOutline } from "@yuragi-labs/core";
import { YuragiText } from "@yuragi-labs/react/static";
import heroAsset from "./hero-outline.json";
import "./Hero.css";

const heroOutline = heroAsset.outline as unknown as TextOutline;

export function Hero() {
  const [animationKey, setAnimationKey] = useState(0);
  const [canReplay, setCanReplay] = useState(false);

  function replayAnimation() {
    setCanReplay(false);
    setAnimationKey((key) => key + 1);
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="hero-eyebrow">揺らぎ · Text in motion</p>

      <div className="hero-wordmark-stage">
        <h1 className="hero-title" id="hero-title">
          <YuragiText
            key={animationKey}
            className="hero-wordmark"
            text={heroAsset.text}
            outline={heroOutline}
            size={190}
            maxWidth={900}
            fallback="error"
            hover="outline"
            animation={{ speed: 1.4 }}
            onEnterComplete={() => setCanReplay(true)}
          />
        </h1>

        {canReplay ? (
          <button
            className="hero-replay"
            type="button"
            onClick={replayAnimation}
          >
            <span aria-hidden="true">↻</span>
            Replay animation
          </button>
        ) : null}
      </div>

      <div className="hero-details">
        <p className="hero-summary">
          Render text as animated SVG fragments, compiled ahead of time or
          directly in the browser with WebAssembly.
        </p>

        <div className="hero-cta">
          <div className="hero-actions">
            <a className="primary-action" href="#playground">
              Open Playground
            </a>
            <a href="https://github.com/lawvs/yuragi">View on GitHub</a>
          </div>
          <code className="install-command">
            pnpm add @yuragi-labs/react
          </code>
        </div>
      </div>
    </section>
  );
}
