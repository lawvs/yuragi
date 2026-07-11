import { useState } from "react";
import { RuntimeDemo } from "./runtime-demo/RuntimeDemo";
import {
  StaticDemo,
  useStaticDemoState,
} from "./static-demo/StaticDemo";
import { WasmLab } from "./wasm-lab/WasmLab";
import { ShardInspector } from "./shard-inspector/ShardInspector";

type PlaygroundView =
  | "runtime-demo"
  | "static-demo"
  | "shard-inspector"
  | "wasm-lab";

const viewPipelines: Record<PlaygroundView, string[]> = {
  "runtime-demo": ["@yuragi/react", "runtime WASM", "shard transitions"],
  "static-demo": ["unplugin", "static outlines", "shard transitions"],
  "shard-inspector": ["runtime WASM", "glyph atlas", "shard analysis"],
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
      {view === "shard-inspector" ? <ShardInspector /> : null}
      {view === "wasm-lab" ? <WasmLab /> : null}
    </main>
  );
}
