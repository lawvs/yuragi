import { useState } from "react";
import { RuntimeDemo } from "../runtime-demo/RuntimeDemo";
import { ShardInspector } from "../shard-inspector/ShardInspector";
import { WasmLab } from "../wasm-lab/WasmLab";

const VIEW_TABS = [
  {
    id: "shard-inspector",
    label: "Shard Inspector",
    View: ShardInspector,
  },
  { id: "runtime-demo", label: "Runtime Demo", View: RuntimeDemo },
  { id: "wasm-lab", label: "WASM Lab", View: WasmLab },
] as const;

type PlaygroundView = (typeof VIEW_TABS)[number]["id"];

export function PlaygroundSection() {
  const [view, setView] = useState<PlaygroundView>("runtime-demo");
  const ActiveView = VIEW_TABS.find((tab) => tab.id === view)!.View;

  return (
    <section className="playground-section" id="playground">
      <header className="playground-header">
        <div>
          <p className="eyebrow">Interactive tools</p>
          <h2>Playground</h2>
        </div>
        <nav className="view-tabs" aria-label="Playground views">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-view={tab.id}
              aria-pressed={view === tab.id}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <ActiveView />
    </section>
  );
}
