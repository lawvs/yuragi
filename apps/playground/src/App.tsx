import { useState } from "react";
import { RuntimeDemo } from "./runtime-demo/RuntimeDemo";
import { WasmLab } from "./wasm-lab/WasmLab";
import { ShardInspector } from "./shard-inspector/ShardInspector";

type PlaygroundView =
  | "runtime-demo"
  | "shard-inspector"
  | "wasm-lab";

export function App() {
  const [view, setView] = useState<PlaygroundView>("runtime-demo");

  return (
    <main className="playground-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">yuragi v1</p>
          <h1>Playground</h1>
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
    </main>
  );
}
