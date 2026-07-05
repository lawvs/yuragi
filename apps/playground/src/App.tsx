import { useState } from "react";
import { RuntimeDemo } from "./runtime-demo/RuntimeDemo";
import {
  StaticDemo,
  useStaticDemoState,
} from "./static-demo/StaticDemo";
import { WasmLab } from "./wasm-lab/WasmLab";

type PlaygroundView = "runtime-demo" | "static-demo" | "wasm-lab";

const viewPipelines: Record<PlaygroundView, string[]> = {
  "runtime-demo": ["@yuragi/react", "runtime WASM", "ViewTransition"],
  "static-demo": ["unplugin", "static outlines", "ViewTransition"],
  "wasm-lab": ["worker", "runtime compiler", "metrics"],
};

export function App() {
  const [view, setView] = useState<PlaygroundView>("runtime-demo");
  const staticDemo = useStaticDemoState();

  return (
    <main className="playground-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">yuragi v1</p>
          <h1>Playground</h1>
        </div>
        <div className="status-strip" aria-label="Pipeline">
          {viewPipelines[view].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <nav className="view-tabs" aria-label="Playground views">
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
            data-view="static-demo"
            aria-pressed={view === "static-demo"}
            onClick={() => setView("static-demo")}
          >
            Static Demo
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
      {view === "static-demo" ? <StaticDemo state={staticDemo} /> : null}
      {view === "wasm-lab" ? <WasmLab /> : null}
    </main>
  );
}
