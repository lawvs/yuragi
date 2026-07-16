import { Hero } from "./hero/Hero";
import { PlaygroundSection } from "./playground/PlaygroundSection";

export function App() {
  return (
    <main className="playground-shell">
      <header className="site-header">
        <a className="site-brand" href="./" aria-label="Yuragi home">
          yuragi
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#playground">Playground</a>
          <a href="https://github.com/lawvs/yuragi#packages">Packages</a>
          <a href="https://github.com/lawvs/yuragi">GitHub</a>
        </nav>
      </header>

      <Hero />

      <PlaygroundSection />

      <footer className="site-footer">
        <span>Built with Yuragi.</span>
        <a href="https://github.com/lawvs/yuragi">Source on GitHub</a>
      </footer>
    </main>
  );
}
