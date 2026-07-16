import { useState } from "react";
import { Hero } from "./hero/Hero";
import { RuntimeDemo } from "./runtime-demo/RuntimeDemo";
import { ShardInspector } from "./shard-inspector/ShardInspector";
import { WasmLab } from "./wasm-lab/WasmLab";

type PlaygroundView =
  | "runtime-demo"
  | "shard-inspector"
  | "wasm-lab";

export function App() {
  const [view, setView] = useState<PlaygroundView>("runtime-demo");

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

      <section className="playground-section" id="playground">
        <header className="playground-header">
          <div>
            <p className="eyebrow">Interactive tools</p>
            <h2>Playground</h2>
          </div>
          <nav className="view-tabs" aria-label="Playground views">
            <button
              type="button"
              data-view="shard-inspector"
              aria-pressed={view === "shard-inspector"}
              onClick={() => setView("shard-inspector")}
            >
              Shard Inspector
            </button>
            <button
              type="button"
              data-view="runtime-demo"
              aria-pressed={view === "runtime-demo"}
              onClick={() => setView("runtime-demo")}
            >
              Runtime Demo
            </button>
            <button
              type="button"
              data-view="wasm-lab"
              aria-pressed={view === "wasm-lab"}
              onClick={() => setView("wasm-lab")}
            >
              WASM Lab
            </button>
          </nav>
        </header>

        {view === "runtime-demo" ? <RuntimeDemo /> : null}
        {view === "shard-inspector" ? <ShardInspector /> : null}
        {view === "wasm-lab" ? <WasmLab /> : null}
      </section>

      <footer className="site-footer">
        <span>Built with Yuragi.</span>
        <a href="https://github.com/lawvs/yuragi">Source on GitHub</a>
      </footer>
    </main>
  );
}
