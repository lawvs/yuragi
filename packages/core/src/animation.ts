export type AnimateShardsOptions = {
  type: "settle" | "scatter";
  speed?: number;
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

export type ShardTiming = {
  duration: number;
  delay: number;
  easing: string;
};

export type PlanShardTimingsOptions = {
  type: "settle" | "scatter";
  speed?: number;
  stagger?: "none" | "by-x";
  shardXs: Array<number | undefined>;
};

const DEFAULT_SPEED = 1;
const BASE_DURATION = 500;
const SPATIAL_STAGGER_WINDOW = 120;
const EASINGS = {
  settle: "cubic-bezier(0, 0, 0, 1)",
  scatter: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

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

function normalizedSpeed(speed: number | undefined): number {
  return typeof speed === "number" && Number.isFinite(speed) && speed > 0
    ? speed
    : DEFAULT_SPEED;
}

function normalizedShardX(
  index: number,
  shardXs: Array<number | undefined>,
): number {
  const finiteXs = shardXs.filter(
    (value): value is number => value !== undefined,
  );
  if (finiteXs.length > 1) {
    const min = Math.min(...finiteXs);
    const max = Math.max(...finiteXs);
    const current = shardXs[index];
    if (max > min && current !== undefined) {
      return (current - min) / (max - min);
    }
  }
  return shardXs.length > 1 ? index / (shardXs.length - 1) : 0;
}

export function planShardTimings(
  options: PlanShardTimingsOptions,
): ShardTiming[] {
  const speed = normalizedSpeed(options.speed);
  const duration = BASE_DURATION / speed;
  const staggerWindow =
    options.stagger === "by-x" ? SPATIAL_STAGGER_WINDOW / speed : 0;

  return options.shardXs.map((_, index) => ({
    duration,
    delay: normalizedShardX(index, options.shardXs) * staggerWindow,
    easing: EASINGS[options.type],
  }));
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

function finiteDatasetNumberOrUndefined(
  value: string | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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

  const distance = options.distance ?? 100;
  const timings = planShardTimings({
    type: options.type,
    speed: options.speed,
    stagger: options.stagger,
    shardXs: shardMotions.map((shardMotion) =>
      finiteDatasetNumberOrUndefined(shardMotion.dataset.shardX),
    ),
  });

  const animations = shardMotions.flatMap((shardMotion, index) => {
    if (typeof shardMotion.animate !== "function") {
      return [];
    }

    const directionX = finiteDatasetNumber(shardMotion.dataset.directionX);
    const directionY = finiteDatasetNumber(shardMotion.dataset.directionY);
    const scale = options.type === "settle" ? 1.05 : 0.95;
    const timing = timings[index];

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
          duration: timing.duration,
          delay: timing.delay,
          easing: timing.easing,
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
