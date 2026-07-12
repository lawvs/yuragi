import { startTransition, useMemo, useState } from "react";
import {
  useYuragiFont,
  YuragiFontProvider,
  YuragiText,
} from "@yuragi/react";
import { runtimePosts } from "../data";
import { alignOptions, type Align } from "../demo-options";
import "../demo.css";
import {
  DEFAULT_AXES,
  DEFAULT_FONT_URL,
  DEFAULT_WASM_URL,
} from "../font-presets";

export function RuntimeDemo() {
  const [selectedId, setSelectedId] = useState(runtimePosts[0]?.id ?? "");
  const [draftTitle, setDraftTitle] = useState(
    runtimePosts[0]?.title ?? "",
  );
  const [size, setSize] = useState(88);
  const [align, setAlign] = useState<Align>("start");
  const [hoverOutline, setHoverOutline] = useState(true);
  const [transitionSpeed, setTransitionSpeed] = useState(1);

  const selectedPost = useMemo(
    () =>
      runtimePosts.find((post) => post.id === selectedId) ??
      runtimePosts[0],
    [selectedId],
  );

  function selectPost(id: string) {
    const post =
      runtimePosts.find((candidate) => candidate.id === id) ??
      runtimePosts[0];

    startTransition(() => {
      setSelectedId(post?.id ?? "");
      setDraftTitle(post?.title ?? "");
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
          {runtimePosts.map((post) => {
            const selected = post.id === selectedId;

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
              onClick={() => selectPost(runtimePosts[0]?.id ?? "")}
            >
              Back
            </button>
            <div className="controls" aria-label="Text controls">
              <RuntimeFontStatus />

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

              <label className="text-control">
                <span>Title</span>
                <input
                  aria-label="Runtime title text"
                  name="runtime-title"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
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

            </div>
          </div>

          <article className="preview-surface">
            <div className="preview-title">
              <YuragiText
                text={draftTitle}
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

function RuntimeFontStatus() {
  const fontState = useYuragiFont();
  const label =
    fontState.status === "ready"
      ? "Font ready"
      : fontState.status === "error"
        ? "Font error"
        : "Loading font";

  return (
    <span className="font-status" data-status={fontState.status}>
      {label}
    </span>
  );
}
