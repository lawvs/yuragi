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

export type VisualRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PlanShardTimingsOptions = {
  type: "settle" | "scatter";
  speed?: number;
  stagger?: "none" | "by-x";
  shardXs: Array<number | undefined>;
};

const DEFAULT_SPEED = 1;
const BASE_DURATION = 500;
const SPATIAL_STAGGER_MS_PER_PX = 1.2;
const FALLBACK_STAGGER_WINDOW = 120;
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

function shardDelay(
  index: number,
  shardXs: Array<number | undefined>,
  speed: number,
): number {
  const finiteXs = shardXs.filter(
    (value): value is number => value !== undefined,
  );
  if (finiteXs.length > 0) {
    const min = Math.min(...finiteXs);
    const current = shardXs[index];
    if (current !== undefined) {
      return ((current - min) * SPATIAL_STAGGER_MS_PER_PX) / speed;
    }
  }

  if (shardXs.length <= 1) return 0;
  return (index / (shardXs.length - 1) / speed) * FALLBACK_STAGGER_WINDOW;
}

export function planShardTimings(
  options: PlanShardTimingsOptions,
): ShardTiming[] {
  const speed = normalizedSpeed(options.speed);
  const duration = BASE_DURATION / speed;

  return options.shardXs.map((_, index) => ({
    duration,
    delay:
      options.stagger === "by-x"
        ? shardDelay(index, options.shardXs, speed)
        : 0,
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

function rectFromDomRect(rect: DOMRect): VisualRect {
  return {
    left: Number.isFinite(rect.left) ? rect.left : 0,
    top: Number.isFinite(rect.top) ? rect.top : 0,
    width: Number.isFinite(rect.width) ? rect.width : 0,
    height: Number.isFinite(rect.height) ? rect.height : 0,
  };
}

function hasVisibleRect(rect: VisualRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

function hasFiniteRect(rect: VisualRect): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  );
}

function matrixPoint(
  matrix: Pick<DOMMatrix, "a" | "b" | "c" | "d" | "e" | "f">,
  x: number,
  y: number,
) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function rectFromSvgGeometry(shard: SVGGraphicsElement): VisualRect | undefined {
  if (
    typeof shard.getBBox !== "function" ||
    typeof shard.getScreenCTM !== "function"
  ) {
    return undefined;
  }

  let box: DOMRect | SVGRect;
  let matrix: DOMMatrix | null;
  try {
    box = shard.getBBox();
    matrix = shard.getScreenCTM();
  } catch {
    return undefined;
  }
  if (!matrix) return undefined;

  const points = [
    matrixPoint(matrix, box.x, box.y),
    matrixPoint(matrix, box.x + box.width, box.y),
    matrixPoint(matrix, box.x, box.y + box.height),
    matrixPoint(matrix, box.x + box.width, box.y + box.height),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const rect = {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };

  return hasFiniteRect(rect) && hasVisibleRect(rect) ? rect : undefined;
}

export function measureShardMotionRect(
  shardMotion: SVGGElement,
): VisualRect | undefined {
  const shard = shardMotion.querySelector<SVGGraphicsElement>("[data-shard]");
  const pathRect = shard ? rectFromSvgGeometry(shard) : undefined;
  if (pathRect) return pathRect;

  const rect = shardMotion.getBoundingClientRect();
  const visualRect = rectFromDomRect(rect);
  if (!hasFiniteRect(visualRect) || !hasVisibleRect(visualRect)) {
    return undefined;
  }

  return visualRect;
}

function visualShardX(shardMotion: SVGGElement): number | undefined {
  const rect = measureShardMotionRect(shardMotion);
  if (!rect) return undefined;
  const centerX = rect.left + rect.width / 2;
  return Number.isFinite(centerX) ? centerX : undefined;
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
      visualShardX(shardMotion) ??
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
