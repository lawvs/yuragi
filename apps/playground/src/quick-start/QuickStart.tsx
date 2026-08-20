import "./QuickStart.css";

const QUICK_START_EXAMPLE = `import { YuragiFontProvider, YuragiText } from "@yuragi-labs/react";

export function Title() {
  return (
    <YuragiFontProvider font="/font.ttf">
      <YuragiText text="Yuragi" size={72} hover="outline" />
    </YuragiFontProvider>
  );
}`;

export function QuickStart() {
  return (
    <section className="quick-start" id="quick-start">
      <h2>Quick start</h2>
      <div className="quick-start-steps">
        <div className="quick-start-row">
          <span>Install</span>
          <div className="install-block">
            <span aria-hidden="true">$</span>
            <code>pnpm add @yuragi-labs/react</code>
          </div>
        </div>
        <div className="quick-start-row">
          <span>React</span>
          <div className="code-block">
            <div>Title.tsx</div>
            <pre><code>{QUICK_START_EXAMPLE}</code></pre>
          </div>
        </div>
      </div>
    </section>
  );
}
