import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
} from "react";
import {
  animateShards,
  createShardedSvg,
  layoutShardedText,
} from "@yuragi/core";
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
  const svgRef = useRef<SVGSVGElement | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const layout = layoutShardedText(data.outline, { size: 220 });
    const svg = createShardedSvg(layout);
    svg.classList.add("inspector-glyph-svg");
    svg.setAttribute("aria-label", data.char);
    const motions = Array.from(
      svg.querySelectorAll<SVGGElement>("[data-shard-motion]"),
    );

    motions.forEach((motion, index) => {
      motion.dataset.inspectorShard = String(index);
      if (selectedShard === index) motion.dataset.selected = "true";
      const path = motion.querySelector<SVGPathElement>("[data-shard]");
      if (path) {
        path.style.fill =
          mode === "assembled" ? "currentColor" : shardColor(index);
      }
      if (mode === "exploded") {
        const direction = data.shards[index]?.direction ?? [0, 0];
        motion.style.transform = `translate(${direction[0] * explodeDistance}px, ${direction[1] * explodeDistance}px)`;
      }
    });

    svgRef.current = svg;
    host.replaceChildren(svg);
  }, [data, explodeDistance, mode, selectedShard]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !playback) return;
    void animateShards(svg, {
      type: playback.type,
      stagger: "by-x",
      distance: playback.distance,
    });
  }, [playback]);

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
