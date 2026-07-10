import { startTransition, useMemo, useState } from "react";
import { YuragiText } from "@yuragi/react/static";
import outlines from "virtual:yuragi/outlines";
import { demoPosts } from "../data";
import { alignOptions, type Align } from "../demo-options";

export function useStaticDemoState() {
  const [selectedId, setSelectedId] = useState(demoPosts[0]?.id ?? "");
  const [size, setSize] = useState(88);
  const [align, setAlign] = useState<Align>("start");
  const [hoverOutline, setHoverOutline] = useState(true);
  const [transitionSpeed, setTransitionSpeed] = useState(1);

  const selectedPost = useMemo(
    () => demoPosts.find((post) => post.id === selectedId) ?? demoPosts[0],
    [selectedId],
  );

  return {
    selectedId,
    setSelectedId,
    selectedPost,
    size,
    setSize,
    align,
    setAlign,
    hoverOutline,
    setHoverOutline,
    transitionSpeed,
    setTransitionSpeed,
  };
}

export type StaticDemoState = ReturnType<typeof useStaticDemoState>;

type StaticDemoProps = {
  state: StaticDemoState;
};

export function StaticDemo({ state }: StaticDemoProps) {
  const {
    selectedId,
    selectedPost,
    setSelectedId,
    size,
    setSize,
    align,
    setAlign,
    hoverOutline,
    setHoverOutline,
    transitionSpeed,
    setTransitionSpeed,
  } = state;

  function selectPost(id: string) {
    startTransition(() => {
      setSelectedId(id);
    });
  }

  return (
    <section
      className="workspace"
      data-demo-kind="static"
      aria-label="Static precompile demo"
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
                  outline={outlines[post.title]}
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

          </div>
        </div>

        <article className="preview-surface">
          <div className="preview-title">
            <YuragiText
              text={selectedPost.title}
              outline={outlines[selectedPost.title]}
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
  );
}
