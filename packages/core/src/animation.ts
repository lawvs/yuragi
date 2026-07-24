export type ShardAnimationOptions = {
  type: "settle" | "scatter";
  speed?: number;
  distance?: number;
  stagger?: "none" | "by-x";
};

export type ShardAnimationResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | {
      status: "skipped";
      reason: "reduced-motion" | "unsupported" | "empty";
    }
  | {
      status: "failed";
      error: ShardAnimationError;
    };

export class ShardAnimationError extends Error {
  readonly phase: "prepare" | "play";
  override readonly cause: unknown;

  constructor(phase: "prepare" | "play", cause: unknown) {
    super(`Shard animation failed during ${phase}`, { cause });
    this.name = "ShardAnimationError";
    this.phase = phase;
    this.cause = cause;
  }
}

export interface ShardAnimationHandle {
  play(): void;
  cancel(): void;
  readonly finished: Promise<ShardAnimationResult>;
}

type BuildShardKeyframesOptions = {
  type: "settle" | "scatter";
  directionX: number;
  directionY: number;
  distance: number;
  scale: number;
};

type ShardTiming = {
  duration: number;
  delay: number;
  easing: string;
};

type PlanShardTimingsOptions = {
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

function buildShardKeyframes(
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

function planShardTimings(
  options: PlanShardTimingsOptions,
): ShardTiming[] {
  const speed = options.speed ?? DEFAULT_SPEED;
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

function validateOptions(options: ShardAnimationOptions): void {
  if (
    options.speed !== undefined &&
    (!Number.isFinite(options.speed) || options.speed <= 0)
  ) {
    throw new RangeError("speed must be finite and greater than zero");
  }
  if (
    options.distance !== undefined &&
    (!Number.isFinite(options.distance) || options.distance < 0)
  ) {
    throw new RangeError("distance must be finite and non-negative");
  }
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

function visualShardX(shardMotion: SVGGElement): number | undefined {
  const rect = shardMotion.getBoundingClientRect();
  const hasVisibleBounds = rect.width > 0 || rect.height > 0;
  if (!hasVisibleBounds) return undefined;

  const centerX = rect.left + rect.width / 2;
  return Number.isFinite(centerX) ? centerX : undefined;
}

function resolvedHandle(
  result: ShardAnimationResult,
): ShardAnimationHandle {
  return {
    play() {},
    cancel() {},
    finished: Promise.resolve(result),
  };
}

const activeHandles = new WeakMap<ParentNode, ShardAnimationHandle>();

function createPreparedHandle(
  root: ParentNode,
  animations: Animation[],
  type: ShardAnimationOptions["type"],
): ShardAnimationHandle {
  type State =
    | "prepared"
    | "running"
    | "completed"
    | "cancelled"
    | "failed";

  let state: State = "prepared";
  let released = false;
  let resolveFinished!: (result: ShardAnimationResult) => void;
  const finished = new Promise<ShardAnimationResult>((resolve) => {
    resolveFinished = resolve;
  });
  const nativeCompletion = Promise.all(
    animations.map((animation) => animation.finished),
  ).then(
    () => ({ ok: true as const }),
    (cause: unknown) => ({ ok: false as const, cause }),
  );

  const release = () => {
    if (released) return;
    released = true;
    animations.forEach((animation) => animation.cancel());
  };
  const detach = () => {
    if (activeHandles.get(root) === handle) {
      activeHandles.delete(root);
    }
  };
  const fail = (cause: unknown) => {
    if (state !== "running") return;
    state = "failed";
    release();
    detach();
    resolveFinished({
      status: "failed",
      error: new ShardAnimationError("play", cause),
    });
  };

  const handle: ShardAnimationHandle = {
    play() {
      if (state !== "prepared") return;
      state = "running";

      void nativeCompletion.then((outcome) => {
        if (state !== "running") return;
        if (!outcome.ok) {
          fail(outcome.cause);
          return;
        }

        state = "completed";
        if (type === "settle") {
          release();
          detach();
        }
        resolveFinished({ status: "completed" });
      });

      try {
        animations.forEach((animation) => animation.play());
      } catch (cause) {
        fail(cause);
      }
    },

    cancel() {
      if (state === "completed") {
        release();
        detach();
        return;
      }
      if (state === "cancelled" || state === "failed") return;

      state = "cancelled";
      release();
      detach();
      resolveFinished({ status: "cancelled" });
    },

    finished,
  };

  return handle;
}

export function prepareShardAnimation(
  root: ParentNode,
  options: ShardAnimationOptions,
): ShardAnimationHandle {
  validateOptions(options);
  activeHandles.get(root)?.cancel();

  const shards = Array.from(
    root.querySelectorAll<SVGGElement>("[data-shard-motion]"),
  );
  if (shards.length === 0) {
    return resolvedHandle({ status: "skipped", reason: "empty" });
  }

  const rootNode = root as Node;
  const ownerDocument =
    rootNode.nodeType === 9 ? (root as Document) : rootNode.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (
    ownerWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return resolvedHandle({
      status: "skipped",
      reason: "reduced-motion",
    });
  }
  if (shards.some((item) => typeof item.animate !== "function")) {
    return resolvedHandle({ status: "skipped", reason: "unsupported" });
  }

  const timings = planShardTimings({
    type: options.type,
    speed: options.speed,
    stagger: options.stagger,
    shardXs: shards.map(
      (item) =>
        visualShardX(item) ??
        finiteDatasetNumberOrUndefined(item.dataset.shardX),
    ),
  });
  const animations: Animation[] = [];

  try {
    shards.forEach((item, index) => {
      const animation = item.animate(
        buildShardKeyframes({
          type: options.type,
          directionX: finiteDatasetNumber(item.dataset.directionX),
          directionY: finiteDatasetNumber(item.dataset.directionY),
          distance: options.distance ?? 100,
          scale: options.type === "settle" ? 1.05 : 0.95,
        }),
        {
          ...timings[index],
          fill: "both",
        },
      );
      animations.push(animation);
      void animation.finished.catch(() => {});
      animation.pause();
      animation.currentTime = 0;
    });

    const handle = createPreparedHandle(root, animations, options.type);
    activeHandles.set(root, handle);
    return handle;
  } catch (cause) {
    animations.forEach((animation) => animation.cancel());
    return resolvedHandle({
      status: "failed",
      error: new ShardAnimationError("prepare", cause),
    });
  }
}
