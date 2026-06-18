import { startTransition, useMemo, useState } from "react";
import { ShardedText } from "@type-shards/react";
import outlines from "virtual:type-shards/outlines";
import { demoPosts, type DemoPost } from "./data";

type Align = "start" | "center" | "end";

const alignOptions: Align[] = ["start", "center", "end"];

function titleSharedId(post: DemoPost) {
  return `title:${post.id}`;
}

export function App() {
  const [selectedId, setSelectedId] = useState(demoPosts[0]?.id ?? "");
  const [size, setSize] = useState(88);
  const [align, setAlign] = useState<Align>("start");
  const [hoverOutline, setHoverOutline] = useState(true);
  const [enterDuration, setEnterDuration] = useState(500);
  const [exitDuration, setExitDuration] = useState(420);

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
    <main className="playground-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">type-shards v1</p>
          <h1>Playground</h1>
        </div>
        <div className="status-strip" aria-label="Pipeline">
          <span>unplugin</span>
          <span>ViewTransition</span>
          <span>core CSS</span>
        </div>
      </header>

      <section className="workspace" aria-label="Playground workspace">
        <aside className="post-list" aria-label="Demo posts">
          {demoPosts.map((post) => {
            const selected = post.id === selectedPost.id;

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
                  <ShardedText
                    text={post.title}
                    outline={outlines[post.title]}
                    sharedId={titleSharedId(post)}
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
                <span>Enter</span>
                <input
                  aria-label="Enter duration"
                  type="range"
                  name="enter-duration"
                  min="100"
                  max="1200"
                  step="20"
                  value={enterDuration}
                  onChange={(event) =>
                    setEnterDuration(Number(event.target.value))
                  }
                />
                <output>{enterDuration}ms</output>
              </label>

              <label className="range-control">
                <span>Exit</span>
                <input
                  aria-label="Exit duration"
                  type="range"
                  name="exit-duration"
                  min="100"
                  max="1200"
                  step="20"
                  value={exitDuration}
                  onChange={(event) =>
                    setExitDuration(Number(event.target.value))
                  }
                />
                <output>{exitDuration}ms</output>
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
              <ShardedText
                text={selectedPost.title}
                outline={outlines[selectedPost.title]}
                sharedId={titleSharedId(selectedPost)}
                size={size}
                maxWidth={760}
                align={align}
                fallback="text"
                hover={hoverOutline ? "outline" : "none"}
                transition={{
                  enter: "settle",
                  exit: "scatter",
                  enterDuration,
                  exitDuration,
                }}
              />
            </div>
            <p>{selectedPost.summary}</p>
          </article>
        </section>
      </section>
    </main>
  );
}
