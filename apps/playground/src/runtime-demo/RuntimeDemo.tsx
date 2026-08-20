import { startTransition, useMemo, useState } from "react";
import { YuragiText } from "@yuragi-labs/react";
import { demoPosts } from "../data";
import { RuntimeControls } from "./RuntimeControls";
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

        <RuntimeControls
          title={draftTitle}
          onTitleChange={setDraftTitle}
          size={size}
          onSizeChange={setSize}
          speed={animationSpeed}
          onSpeedChange={setAnimationSpeed}
          hoverOutline={hoverOutline}
          onHoverOutlineChange={setHoverOutline}
          hoverMotion={hoverMotion}
          onHoverMotionChange={setHoverMotion}
        />
      </section>
    </section>
  );
}
