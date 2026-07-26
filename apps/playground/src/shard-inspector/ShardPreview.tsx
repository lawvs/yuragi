import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  renderYuragiText,
  type YuragiTextHandle,
} from "@yuragi-labs/core";
import type { InspectorGlyph } from "./model";

export type InspectorMode = "assembled" | "colored" | "exploded";

export type InspectorPlayback = {
  type: "settle" | "scatter";
  distance: number;
};

const SHARD_COLORS = [
  "#d1495b",
  "#00798c",
  "#edae49",
  "#30638e",
  "#4f772d",
  "#8f5aa2",
  "#f26419",
  "#2a9d8f",
];

export function shardColor(index: number): string {
  return SHARD_COLORS[index % SHARD_COLORS.length] ?? SHARD_COLORS[0]!;
}

export function ShardPreview({
  data,
  explodeDistance,
  mode,
  onPlay,
  playback,
  onSelectShard,
  selectedShard,
}: {
  data: InspectorGlyph;
  explodeDistance: number;
  mode: InspectorMode;
  onPlay: (type: InspectorPlayback["type"]) => void;
  playback: InspectorPlayback | null;
  onSelectShard: (index: number) => void;
  selectedShard: number | null;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const renderedRef = useRef<YuragiTextHandle | null>(null);
  const playbackRef = useRef<YuragiTextHandle | null>(null);

  function decorateSvg(svg: SVGSVGElement): void {
    svg.classList.add("inspector-glyph-svg");
    const motions = Array.from(
      svg.querySelectorAll<SVGGElement>("[data-shard-motion]"),
    );

    motions.forEach((motion, index) => {
      motion.dataset.inspectorShard = String(index);
      const selected = selectedShard === index;
      if (selected) motion.dataset.selected = "true";
      else delete motion.dataset.selected;
      const path = motion.querySelector<SVGPathElement>("[data-shard]");
      if (path) {
        path.style.fill =
          mode === "assembled" && !selected
            ? "currentColor"
            : shardColor(index);
        path.style.stroke =
          mode === "assembled" && selected ? shardColor(index) : "";
      }
      if (mode === "exploded") {
        const direction = data.shards[index]?.direction ?? [0, 0];
        motion.style.transform = `translate(${direction[0] * explodeDistance}px, ${direction[1] * explodeDistance}px)`;
      }
    });
  }

  function renderPreview(
    animation:
      | false
      | {
          autoplay: false;
          distance: number;
          stagger: "by-x";
        },
  ): YuragiTextHandle | null {
    const host = hostRef.current;
    if (!host) return null;
    const handle = renderYuragiText(host, data.outline, {
      size: 220,
      ariaLabel: data.char,
      animation,
    });
    decorateSvg(handle.element);
    renderedRef.current = handle;
    return handle;
  }

  function renderStaticPreview(): YuragiTextHandle | null {
    return renderPreview(false);
  }

  useLayoutEffect(() => {
    const activePlayback = playbackRef.current;
    playbackRef.current = null;
    activePlayback?.dispose();
    if (
      renderedRef.current &&
      renderedRef.current !== activePlayback
    ) {
      renderedRef.current.dispose();
    }
    renderedRef.current = null;
    renderStaticPreview();
  }, [data, explodeDistance, mode, selectedShard]);

  useLayoutEffect(() => {
    if (!playback) {
      if (!renderedRef.current) renderStaticPreview();
      return;
    }

    let active = true;
    if (playback.type === "settle") {
      renderedRef.current?.dispose();
      const handle = renderPreview({
        autoplay: false,
        distance: playback.distance,
        stagger: "by-x",
      });
      if (!handle) return;

      playbackRef.current = handle;
      handle.play();
      return () => {
        active = false;
        if (playbackRef.current !== handle) return;
        playbackRef.current = null;
        if (renderedRef.current === handle) {
          renderedRef.current = null;
        }
        handle.dispose();
      };
    }

    const handle =
      renderedRef.current ?? renderStaticPreview();
    if (!handle) return;
    playbackRef.current = handle;
    void handle
      .remove({ distance: playback.distance })
      .then(() => {
        if (!active || playbackRef.current !== handle) return;
        playbackRef.current = null;
        renderStaticPreview();
      });

    return () => {
      active = false;
      if (playbackRef.current !== handle) return;
      playbackRef.current = null;
      if (renderedRef.current === handle) {
        renderedRef.current = null;
      }
      handle.dispose();
    };
  }, [playback]);

  useLayoutEffect(
    () => () => {
      const activePlayback = playbackRef.current;
      playbackRef.current = null;
      activePlayback?.dispose();
      if (
        renderedRef.current &&
        renderedRef.current !== activePlayback
      ) {
        renderedRef.current.dispose();
      }
      renderedRef.current = null;
    },
    [],
  );

  function selectShard(event: MouseEvent<HTMLSpanElement>) {
    const target = event.target as Element;
    const motion = target.closest<SVGGElement>("[data-inspector-shard]");
    const index = Number(motion?.dataset.inspectorShard);
    if (Number.isInteger(index)) onSelectShard(index);
  }

  return (
    <div
      className="inspector-preview-stage"
      style={
        {
          "--inspector-explode-distance":
            mode === "exploded" ? `${explodeDistance}px` : "0px",
        } as CSSProperties
      }
    >
      <span
        ref={hostRef}
        className="inspector-preview-host"
        onClick={selectShard}
      />
      <div className="inspector-playback" aria-label="Animation playback">
        <button
          type="button"
          data-action="play-settle"
          onClick={() => onPlay("settle")}
        >
          Settle
        </button>
        <button
          type="button"
          data-action="play-scatter"
          onClick={() => onPlay("scatter")}
        >
          Scatter
        </button>
      </div>
    </div>
  );
}
