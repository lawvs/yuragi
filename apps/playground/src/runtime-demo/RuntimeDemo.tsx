import { startTransition, useMemo, useState } from "react";
import { useYuragiFont, YuragiText } from "@yuragi-labs/react";
import { demoPosts } from "../data";
import "./RuntimeDemo.css";

export function RuntimeDemo() {
  const [selectedId, setSelectedId] = useState(demoPosts[0]?.id ?? "");
  const [draftTitle, setDraftTitle] = useState(
    demoPosts[0]?.title ?? "",
  );
  const [size, setSize] = useState(88);
  const [hoverOutline, setHoverOutline] = useState(true);
  const [hoverMotion, setHoverMotion] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  const selectedPost = useMemo(
    () =>
      demoPosts.find((post) => post.id === selectedId) ?? demoPosts[0],
    [selectedId],
  );

  function selectPost(id: string) {
    const post =
      demoPosts.find((candidate) => candidate.id === id) ?? demoPosts[0];

    startTransition(() => {
      setSelectedId(post?.id ?? "");
      setDraftTitle(post?.title ?? "");
    });
  }

  return (
    <section
      className="workspace"
      data-demo-kind="runtime"
      aria-label="Interactive React demo"
    >
      <aside className="post-list" aria-label="Demo posts">
        {demoPosts.map((post) => {
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
                  hover={hoverOutline ? "outline" : "none"}
                  hoverMotion={hoverMotion}
                  animation={{ exit: false }}
                />
              </span>
              <span className="post-summary">{post.summary}</span>
            </button>
          );
        })}
      </aside>

      <section className="detail-panel" aria-label="Selected post">
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
              aria-label="Title text"
              name="runtime-title"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
            />
          </label>

          <label className="range-control">
            <span>Speed</span>
            <input
              aria-label="Animation speed"
              type="range"
              name="animation-speed"
              min="0.25"
              max="2"
              step="0.05"
              value={animationSpeed}
              onChange={(event) =>
                setAnimationSpeed(Number(event.target.value))
              }
            />
            <output>{animationSpeed.toFixed(2)}x</output>
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
              name="hover-motion"
              checked={hoverMotion}
              onChange={(event) => setHoverMotion(event.target.checked)}
            />
            <span>Hover motion</span>
          </label>
        </div>

        <article className="preview-surface">
          <div className="preview-title">
            <YuragiText
              text={draftTitle}
              size={size}
              maxWidth={760}
              hover={hoverOutline ? "outline" : "none"}
              hoverMotion={hoverMotion}
              animation={{ exit: true, speed: animationSpeed }}
            />
          </div>
          <p>{selectedPost.summary}</p>
        </article>
      </section>
    </section>
  );
}

function RuntimeFontStatus() {
  const fontState = useYuragiFont();
  const loading = fontState.status === "loading";
  const label =
    fontState.status === "ready"
      ? "Font ready"
      : fontState.status === "error"
        ? "Font error"
        : "Preparing demo…";

  return (
    <span
      className="font-status"
      data-status={fontState.status}
      role="status"
      aria-live="polite"
    >
      {loading ? (
        <span className="font-status-spinner" aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}
