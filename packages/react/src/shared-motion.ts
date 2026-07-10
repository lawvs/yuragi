import {
  measureShardMotionRect,
  planShardTimings,
  type VisualRect,
} from "@yuragi/core";

export type SharedMotionOwner = symbol;

type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SharedMotionSnapshot = {
  id: string;
  owner: SharedMotionOwner;
  allowSameOwner: boolean;
  sourceSvg: SVGSVGElement;
  sourceVisibility: string;
  rootRect: RectSnapshot;
  shardRects: RectSnapshot[];
  expiresAt: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  consumed: boolean;
};

const SNAPSHOT_TTL_MS = 1500;
const sharedSnapshots = new Map<string, SharedMotionSnapshot>();

function now(): number {
  return Date.now();
}

function snapshotRect(rect: DOMRect): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function snapshotVisualRect(rect: VisualRect): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function hasVisibleRect(rect: RectSnapshot): boolean {
  return rect.width > 0 && rect.height > 0;
}

function centerX(rect: RectSnapshot): number {
  return rect.left + rect.width / 2;
}

function centerY(rect: RectSnapshot): number {
  return rect.top + rect.height / 2;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(3)).toString();
}

function normalizedScale(source: RectSnapshot, target: RectSnapshot): number {
  const fromHeight =
    hasVisibleRect(source) && hasVisibleRect(target)
      ? source.height / target.height
      : Number.NaN;
  const fromWidth =
    source.width > 0 && target.width > 0
      ? source.width / target.width
      : Number.NaN;
  const scale = Number.isFinite(fromHeight) ? fromHeight : fromWidth;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(Math.max(scale, 0.05), 20);
}

function shardMotions(svg: SVGSVGElement): SVGGElement[] {
  return Array.from(svg.querySelectorAll<SVGGElement>("[data-shard-motion]"));
}

function measureShardRects(
  shards: SVGGElement[],
): RectSnapshot[] | undefined {
  if (shards.length === 0) return undefined;

  const rects: RectSnapshot[] = [];
  for (const shard of shards) {
    const rect = measureShardMotionRect(shard);
    if (!rect) return undefined;
    rects.push(snapshotVisualRect(rect));
  }
  return rects;
}

function prefersReducedMotion(svg: SVGSVGElement): boolean {
  return Boolean(
    svg.ownerDocument.defaultView?.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches,
  );
}

function pruneExpiredSnapshots(): void {
  const current = now();
  for (const [id, snapshot] of sharedSnapshots) {
    if (snapshot.expiresAt <= current || snapshot.consumed) {
      if (snapshot.cleanupTimer) clearTimeout(snapshot.cleanupTimer);
      sharedSnapshots.delete(id);
    }
  }
}

function deleteSnapshot(id: string, snapshot: SharedMotionSnapshot): void {
  if (snapshot.cleanupTimer) clearTimeout(snapshot.cleanupTimer);
  if (sharedSnapshots.get(id) === snapshot) {
    sharedSnapshots.delete(id);
  }
}

function restoreSourceVisibility(snapshot: SharedMotionSnapshot): void {
  if (!snapshot.sourceSvg.isConnected) return;
  if (snapshot.sourceVisibility) {
    snapshot.sourceSvg.style.visibility = snapshot.sourceVisibility;
  } else {
    snapshot.sourceSvg.style.removeProperty("visibility");
  }
}

function hideSource(snapshot: SharedMotionSnapshot): () => void {
  if (!snapshot.sourceSvg.isConnected) return () => undefined;
  snapshot.sourceSvg.style.visibility = "hidden";
  return () => restoreSourceVisibility(snapshot);
}

function ignoreAnimationFailure(error: unknown): void {
  void error;
}

export function clearSharedMotionSnapshots(): void {
  for (const snapshot of sharedSnapshots.values()) {
    if (snapshot.cleanupTimer) clearTimeout(snapshot.cleanupTimer);
  }
  sharedSnapshots.clear();
}

export function captureSharedMotionSnapshot(
  id: string,
  owner: SharedMotionOwner,
  svg: SVGSVGElement,
  options: { allowSameOwner?: boolean } = {},
): SharedMotionSnapshot | undefined {
  pruneExpiredSnapshots();

  const rootRect = snapshotRect(svg.getBoundingClientRect());
  if (!hasVisibleRect(rootRect)) return undefined;

  const shardRects = measureShardRects(shardMotions(svg));
  if (!shardRects) return undefined;

  const existing = sharedSnapshots.get(id);
  if (existing?.cleanupTimer) clearTimeout(existing.cleanupTimer);

  const snapshot: SharedMotionSnapshot = {
    id,
    owner,
    allowSameOwner: options.allowSameOwner === true,
    sourceSvg: svg,
    sourceVisibility: svg.style.visibility,
    rootRect,
    shardRects,
    expiresAt: now() + SNAPSHOT_TTL_MS,
    consumed: false,
  };
  snapshot.cleanupTimer = setTimeout(() => {
    deleteSnapshot(id, snapshot);
  }, SNAPSHOT_TTL_MS);
  sharedSnapshots.set(id, snapshot);
  return snapshot;
}

export function wasSharedMotionSnapshotConsumed(
  snapshot: SharedMotionSnapshot | undefined,
): boolean {
  return Boolean(snapshot?.consumed);
}

export function tryAnimateSharedMotionEnter(
  id: string,
  owner: SharedMotionOwner,
  targetSvg: SVGSVGElement,
  options: { speed?: number } = {},
): boolean {
  pruneExpiredSnapshots();

  const snapshot = sharedSnapshots.get(id);
  if (!snapshot) return false;
  deleteSnapshot(id, snapshot);

  if (
    (snapshot.owner === owner && !snapshot.allowSameOwner) ||
    snapshot.expiresAt <= now()
  ) {
    return false;
  }

  const targetShards = shardMotions(targetSvg);
  if (
    targetShards.length === 0 ||
    targetShards.length !== snapshot.shardRects.length
  ) {
    return false;
  }

  const targetRootRect = snapshotRect(targetSvg.getBoundingClientRect());
  if (!hasVisibleRect(targetRootRect)) return false;

  if (prefersReducedMotion(targetSvg)) {
    return false;
  }

  if (targetShards.some((shard) => typeof shard.animate !== "function")) {
    return false;
  }

  const targetRects = measureShardRects(targetShards);
  if (!targetRects || targetRects.some((rect) => !hasVisibleRect(rect))) {
    return false;
  }

  const scale = normalizedScale(snapshot.rootRect, targetRootRect);
  const timings = planShardTimings({
    type: "settle",
    speed: options.speed,
    stagger: "by-x",
    shardXs: targetRects.map(centerX),
  });

  snapshot.consumed = true;
  const restoreVisibility = hideSource(snapshot);
  const animations = targetShards.map((shard, index) => {
    const sourceRect = snapshot.shardRects[index];
    const targetRect = targetRects[index];
    const dx = centerX(sourceRect) - centerX(targetRect);
    const dy = centerY(sourceRect) - centerY(targetRect);
    const timing = timings[index];

    try {
      const animation = shard.animate(
        [
          {
            transform: `translate(${formatNumber(dx)}px, ${formatNumber(
              dy,
            )}px) scale(${formatNumber(scale)})`,
          },
          {},
        ],
        {
          duration: timing.duration,
          delay: timing.delay,
          easing: timing.easing,
          fill: "both",
        },
      );
      return animation.finished.catch(ignoreAnimationFailure);
    } catch {
      return Promise.resolve();
    }
  });

  void Promise.all(animations).finally(restoreVisibility);
  return true;
}
