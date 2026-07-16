import type { TextOutline } from "@yuragi-labs/core";
import { YuragiText } from "@yuragi-labs/react/static";
import heroAsset from "./hero-outline.json";
import "./Hero.css";

const heroOutline = heroAsset.outline as unknown as TextOutline;

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="hero-eyebrow">揺らぎ · Text in motion</p>

      <h1 className="hero-title" id="hero-title">
        <YuragiText
          className="hero-wordmark"
          text={heroAsset.text}
          outline={heroOutline}
          size={190}
          maxWidth={900}
          fallback="error"
          hover="outline"
          transition={{ enter: "settle", speed: 0.8 }}
        />
      </h1>

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
