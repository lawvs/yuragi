import { useState } from "react";
import { YuragiFontProvider, YuragiText } from "@yuragi/react";
import { RuntimeControls } from "./RuntimeControls";

const FONT_URL =
  "https://raw.githubusercontent.com/adobe-fonts/source-han-serif/release/Variable/OTF/SourceHanSerifSC-VF.otf";
const AXES = { wght: 900 };
const PRESETS = ["Dashboard", "Settings", "揺らぎ", "Live Runtime Title"] as const;

export function App() {
  const [title, setTitle] = useState<string>(PRESETS[0]);
  const [size, setSize] = useState(88);
  const [speed, setSpeed] = useState(1);
  const [hoverOutline, setHoverOutline] = useState(true);
  const [sharedMotion, setSharedMotion] = useState(true);

  return (
    <YuragiFontProvider font={FONT_URL} axes={AXES}>
      <main className="example-shell">
        <RuntimeControls
          title={title}
          onTitleChange={setTitle}
          size={size}
          onSizeChange={setSize}
          speed={speed}
          onSpeedChange={setSpeed}
          hoverOutline={hoverOutline}
          onHoverOutlineChange={setHoverOutline}
          sharedMotion={sharedMotion}
          onSharedMotionChange={setSharedMotion}
          presets={PRESETS}
        />

        <section className="preview" aria-label="Runtime preview">
          <YuragiText
            text={title}
            sharedId={sharedMotion ? "example:title" : false}
            size={size}
            maxWidth={860}
            align="start"
            fallback="text"
            hover={hoverOutline ? "outline" : "none"}
            transition={{
              enter: "settle",
              exit: "scatter",
              speed,
            }}
          />
        </section>
      </main>
    </YuragiFontProvider>
  );
}
