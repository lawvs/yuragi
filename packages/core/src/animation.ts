export type AnimateShardsOptions = {
  type: "settle" | "scatter";
  duration?: number;
  distance?: number;
  stagger?: "none" | "by-x";
  direction?: "outline-vector";
};

export type BuildShardKeyframesOptions = {
  type: "settle" | "scatter";
  directionX: number;
  directionY: number;
  distance: number;
  scale: number;
};

export function buildShardKeyframes(
  options: BuildShardKeyframesOptions,
): Keyframe[] {
  const x = options.directionX * options.distance;
  const y = options.directionY * options.distance;
  const freeFrame: Keyframe = {
    opacity: 0,
    transform: `translate(${x}px, ${y}px) scale(${options.scale})`,
  };
  return options.type === "settle" ? [freeFrame, {}] : [{}, freeFrame];
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function finiteDatasetNumber(value: string | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function ignoreAnimationFailure(error: unknown): void {
  void error;
}

export async function animateShards(
  root: ParentNode,
  options: AnimateShardsOptions,
): Promise<void> {
  const shardMotions = Array.from(
    root.querySelectorAll<SVGGElement>("[data-shard-motion]"),
  );

  if (prefersReducedMotion()) {
    return undefined;
  }

  const duration = options.duration ?? (options.type === "settle" ? 500 : 220);
  const distance = options.distance ?? 100;

  const animations = shardMotions.flatMap((shardMotion, index) => {
    if (typeof shardMotion.animate !== "function") {
      return [];
    }

    const directionX = finiteDatasetNumber(shardMotion.dataset.directionX);
    const directionY = finiteDatasetNumber(shardMotion.dataset.directionY);
    const delay = options.stagger === "by-x" ? index * 12 : 0;
    const scale = options.type === "settle" ? 1.05 : 0.95;

    try {
      const animation = shardMotion.animate(
        buildShardKeyframes({
          type: options.type,
          directionX,
          directionY,
          distance,
          scale,
        }),
        {
          duration,
          delay,
          easing:
            options.type === "settle"
              ? "cubic-bezier(0, 0, 0, 1)"
              : "cubic-bezier(1, 0, 1, 1)",
          fill: "both",
        },
      );

      return [animation.finished.catch(ignoreAnimationFailure)];
    } catch {
      return [];
    }
  });

  await Promise.all(animations);
}
