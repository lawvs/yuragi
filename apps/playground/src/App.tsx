import { useState } from "react";
import {
  StaticDemo,
  useStaticDemoState,
} from "./static-demo/StaticDemo";
import { WasmLab } from "./wasm-lab/WasmLab";

type PlaygroundView = "demo" | "wasm-lab";

export function App() {
  const [view, setView] = useState<PlaygroundView>("demo");
  const staticDemo = useStaticDemoState();

  return (
    <main className="playground-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">yuragi v1</p>
          <h1>Playground</h1>
        </div>
        <div className="status-strip" aria-label="Pipeline">
          <span>unplugin</span>
          <span>ViewTransition</span>
          <span>core CSS</span>
        </div>
        <nav className="view-tabs" aria-label="Playground views">
          <button
            type="button"
            data-view="demo"
            aria-pressed={view === "demo"}
            onClick={() => setView("demo")}
          >
            Demo
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

      {view === "wasm-lab" ? <WasmLab /> : <StaticDemo state={staticDemo} />}
    </main>
  );
}
