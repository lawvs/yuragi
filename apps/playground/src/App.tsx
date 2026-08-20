import { Hero } from "./hero/Hero";
import { PlaygroundSection } from "./playground/PlaygroundSection";
import { QuickStart } from "./quick-start/QuickStart";

export function App() {
  return (
    <main className="playground-shell" id="top">
      <header className="site-header">
        <a className="site-brand" href="#top" aria-label="Yuragi home">
          yuragi
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#quick-start">Quick start</a>
          <a href="#playground">Playground</a>
          <a href="https://github.com/lawvs/yuragi">GitHub ↗</a>
        </nav>
      </header>

      <Hero />

      <QuickStart />

      <div className="site-tools">
        <PlaygroundSection />
      </div>

      <footer className="site-footer">
        <div className="site-footer-brand">
          <a className="site-brand" href="#top" aria-label="Yuragi home">
            yuragi
          </a>
          <p>Font geometry in motion.</p>
          <small>MIT © 2026</small>
        </div>
        <nav aria-label="Footer navigation">
          <a href="https://github.com/lawvs/yuragi">GitHub</a>
          <a href="https://www.npmjs.com/package/@yuragi-labs/react">
            npm
          </a>
          <a href="#quick-start">Quick start</a>
          <a href="#playground">Playground</a>
        </nav>
      </footer>
    </main>
  );
}
