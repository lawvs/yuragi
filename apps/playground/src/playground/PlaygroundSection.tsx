import { useState } from "react";
import { YuragiFontProvider } from "@yuragi-labs/react";
import { demoPosts } from "../data";
import {
  DEFAULT_AXES,
  DEFAULT_FONT_URL,
  DEFAULT_WASM_URL,
} from "../font-presets";
import { MorphLab } from "../morph-lab/MorphLab";
import { RuntimeDemo } from "../runtime-demo/RuntimeDemo";
import { ShardInspector } from "../shard-inspector/ShardInspector";
import { WasmLab } from "../wasm-lab/WasmLab";

const demoTitles = demoPosts.map((post) => post.title);

const VIEW_TABS = [
  { id: "runtime-demo", label: "Demo", View: RuntimeDemo },
  {
    id: "shard-inspector",
    label: "Shard Inspector",
    View: ShardInspector,
  },
  { id: "wasm-lab", label: "WASM Lab", View: WasmLab },
  { id: "morph-lab", label: "Morph Lab", View: MorphLab },
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

      <YuragiFontProvider
        font={DEFAULT_FONT_URL}
        wasm={DEFAULT_WASM_URL}
        axes={DEFAULT_AXES}
        preload={demoTitles}
        includeStyles={false}
      >
        <ActiveView />
      </YuragiFontProvider>
    </section>
  );
}
