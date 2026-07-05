import { startTransition, useMemo, useState } from "react";
import { YuragiFontProvider, YuragiText } from "@yuragi/react";
import { demoPosts } from "../data";
import {
  alignOptions,
  titleSharedId,
  type Align,
} from "../demo-options";
import {
  DEFAULT_AXES,
  DEFAULT_FONT_URL,
  DEFAULT_WASM_URL,
} from "../font-presets";

export function RuntimeDemo() {
  const [selectedId, setSelectedId] = useState(demoPosts[0]?.id ?? "");
  const [size, setSize] = useState(88);
  const [align, setAlign] = useState<Align>("start");
  const [hoverOutline, setHoverOutline] = useState(true);
  const [sharedTitleMotion, setSharedTitleMotion] = useState(true);
  const [transitionSpeed, setTransitionSpeed] = useState(1);

  const selectedPost = useMemo(
    () => demoPosts.find((post) => post.id === selectedId) ?? demoPosts[0],
    [selectedId],
  );

  function selectPost(id: string) {
    startTransition(() => {
      setSelectedId(id);
    });
  }

  return (
    <YuragiFontProvider
      font={DEFAULT_FONT_URL}
      wasm={DEFAULT_WASM_URL}
      axes={DEFAULT_AXES}
    >
      <section
        className="workspace"
        data-demo-kind="runtime"
        aria-label="Runtime React demo"
      >
        <aside className="post-list" aria-label="Demo posts">
          {demoPosts.map((post) => {
            const selected = post.id === selectedId;
            const shouldShare = sharedTitleMotion && !selected;

            return (
              <button
                className="post-button"
                data-post-id={post.id}
                type="button"
                key={post.id}
                aria-pressed={selected}
                onClick={() => selectPost(post.id)}
              >
                <span className="post-title">
                  <YuragiText
                    text={post.title}
                    sharedId={shouldShare ? titleSharedId(post) : false}
                    size={30}
                    maxWidth={320}
                    fallback="text"
                    hover={hoverOutline ? "outline" : "none"}
                  />
                </span>
                <span className="post-summary">{post.summary}</span>
              </button>
            );
          })}
        </aside>

        <section className="detail-panel" aria-label="Selected post">
          <div className="detail-header">
            <button
              className="back-button"
              type="button"
              onClick={() => selectPost(demoPosts[0]?.id ?? "")}
            >
              Back
            </button>
            <div className="controls" aria-label="Text controls">
              <label className="range-control">
                <span>Size</span>
                <input
                  aria-label="Title size"
                  type="range"
                  min="48"
                  max="140"
                  step="2"
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                />
                <output>{size}px</output>
              </label>

              <label className="range-control">
                <span>Speed</span>
                <input
                  aria-label="Transition speed"
                  type="range"
                  name="transition-speed"
                  min="0.25"
                  max="2"
                  step="0.05"
                  value={transitionSpeed}
                  onChange={(event) =>
                    setTransitionSpeed(Number(event.target.value))
                  }
                />
                <output>{transitionSpeed.toFixed(2)}x</output>
              </label>

              <label className="select-control">
                <span>Align</span>
                <select
                  aria-label="Title alignment"
                  name="align"
                  value={align}
                  onChange={(event) => setAlign(event.target.value as Align)}
                >
                  {alignOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="toggle-control">
                <input
                  type="checkbox"
                  name="hover"
                  checked={hoverOutline}
                  onChange={(event) => setHoverOutline(event.target.checked)}
                />
                <span>Hover outline</span>
              </label>

              <label className="toggle-control">
                <input
                  type="checkbox"
                  name="shared-title-motion"
                  checked={sharedTitleMotion}
                  onChange={(event) =>
                    setSharedTitleMotion(event.target.checked)
                  }
                />
                <span>Shared title motion</span>
              </label>
            </div>
          </div>

          <article className="preview-surface">
            <div className="preview-title">
              <YuragiText
                text={selectedPost.title}
                sharedId={
                  sharedTitleMotion ? titleSharedId(selectedPost) : false
                }
                size={size}
                maxWidth={760}
                align={align}
                fallback="text"
                hover={hoverOutline ? "outline" : "none"}
                transition={{
                  enter: "settle",
                  exit: "scatter",
                  speed: transitionSpeed,
                }}
              />
            </div>
            <p>{selectedPost.summary}</p>
          </article>
        </section>
      </section>
    </YuragiFontProvider>
  );
}
