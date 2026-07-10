import { useLayoutEffect, useRef } from "react";
import {
  animateShards,
  createShardedSvg,
  layoutShardedText,
  type TextOutline,
} from "@yuragi/core";
import { createSettleAnimationOptions } from "./animation-options";
import {
  animateSvgExit,
  pickSvgExitSnapshot,
  refreshRenderedSvgExitSnapshot,
  type SvgExitSnapshot,
} from "./exit-overlay";
import {
  captureSharedMotionSnapshot,
  tryAnimateSharedMotionEnter,
  wasSharedMotionSnapshotConsumed,
  type SharedMotionOwner,
  type SharedMotionSnapshot,
} from "./shared-motion";
import { applySvgStyle } from "./style";
import type { ResolvedYuragiTextProps } from "./types";

type RenderedSvgState = {
  svg: SVGSVGElement;
  owner: SharedMotionOwner;
  sharedId?: string;
  outline: TextOutline;
  text: string;
  size: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
  exitSnapshot?: SvgExitSnapshot;
};

function hasSameSvgLayout(
  previous: RenderedSvgState | null,
  props: ResolvedYuragiTextProps,
): boolean {
  return (
    previous !== null &&
    previous.outline === props.outline &&
    previous.text === props.text &&
    previous.size === props.size &&
    previous.maxWidth === props.maxWidth &&
    previous.align === props.align
  );
}

export function ShardedSvg({ props }: { props: ResolvedYuragiTextProps }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const renderedSvgRef = useRef<RenderedSvgState | null>(null);
  const pendingScatterRef = useRef<{ cancelled: boolean } | null>(null);
  const pendingEnterRef = useRef<{ cancelled: boolean } | null>(null);
  const ownerRef = useRef<SharedMotionOwner>(Symbol("yuragi-text"));
  const latestTransitionRef = useRef(props.transition);
  latestTransitionRef.current = props.transition;

  function cancelPendingEnter() {
    const pending = pendingEnterRef.current;
    if (pending) pending.cancelled = true;
    pendingEnterRef.current = null;
  }

  function captureSharedSnapshot(
    renderedSvg: RenderedSvgState | undefined,
    options: { allowSameOwner?: boolean } = {},
  ): SharedMotionSnapshot | undefined {
    if (!renderedSvg?.sharedId) return undefined;
    return captureSharedMotionSnapshot(
      renderedSvg.sharedId,
      renderedSvg.owner,
      renderedSvg.svg,
      options,
    );
  }

  function scheduleSvgExit(
    svg: SVGSVGElement,
    options: {
      snapshot?: SvgExitSnapshot;
      speed?: number;
      sharedSnapshot?: SharedMotionSnapshot;
    } = {},
  ) {
    const runExit = () => {
      animateSvgExit(svg, {
        snapshot: options.snapshot,
        speed: options.speed,
      });
    };

    if (options.sharedSnapshot) {
      queueMicrotask(() => {
        queueMicrotask(() => {
          if (wasSharedMotionSnapshotConsumed(options.sharedSnapshot)) return;
          runExit();
        });
      });
      return;
    }

    runExit();
  }

  function runEnterAnimation(renderedSvg: RenderedSvgState) {
    const transition = latestTransitionRef.current;
    const sharedId = renderedSvg.sharedId;
    if (
      sharedId &&
      tryAnimateSharedMotionEnter(sharedId, renderedSvg.owner, renderedSvg.svg, {
        speed: transition?.speed,
      })
    ) {
      return;
    }

    if (transition?.enter === "settle") {
      void animateShards(
        renderedSvg.svg,
        createSettleAnimationOptions(transition.speed),
      );
    }
  }

  function scheduleEnterAnimation(renderedSvg: RenderedSvgState) {
    cancelPendingEnter();

    if (!renderedSvg.sharedId) {
      runEnterAnimation(renderedSvg);
      return;
    }

    const pending = { cancelled: false };
    pendingEnterRef.current = pending;
    queueMicrotask(() => {
      if (pending.cancelled || renderedSvgRef.current !== renderedSvg) return;
      runEnterAnimation(renderedSvg);
      if (pendingEnterRef.current === pending) pendingEnterRef.current = null;
    });
  }

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !props.outline) return;

    const current = renderedSvgRef.current;
    const sharedId = props.sharedId || undefined;
    if (hasSameSvgLayout(current, props)) {
      if (props.style && current) {
        applySvgStyle(current.svg, props.style);
        refreshRenderedSvgExitSnapshot(current, current.svg);
      }
      if (current && current.sharedId !== sharedId) {
        captureSharedSnapshot(current);
        current.sharedId = sharedId;
        if (sharedId) scheduleEnterAnimation(current);
      }
      return;
    }

    const previous = current;
    const layout = layoutShardedText(props.outline, {
      size: props.size,
      maxWidth: props.maxWidth,
      align: props.align,
    });
    const svg = createShardedSvg(layout, {
      className: props.className,
      hover: props.hover === "outline" ? "outline" : "none",
    });
    if (props.style) {
      applySvgStyle(svg, props.style);
    }
    svgRef.current = svg;
    const renderedSvg: RenderedSvgState = {
      svg,
      owner: ownerRef.current,
      sharedId,
      outline: props.outline,
      text: props.text,
      size: props.size,
      maxWidth: props.maxWidth,
      align: props.align,
    };
    renderedSvgRef.current = renderedSvg;

    const previousSvg = previous?.svg;
    const shouldScatterPrevious =
      previousSvg?.parentElement === host &&
      props.transition?.exit === "scatter";
    const shouldCapturePreviousShared =
      previousSvg?.parentElement === host &&
      previous?.sharedId !== undefined;
    const previousSharedSnapshot = shouldCapturePreviousShared
      ? captureSharedSnapshot(previous, {
          allowSameOwner: previous.sharedId === sharedId,
        })
      : undefined;

    if (shouldScatterPrevious && previousSvg) {
      const exitSnapshot = pickSvgExitSnapshot(
        previousSvg,
        previous?.exitSnapshot,
      );
      host.replaceChildren(svg);
      scheduleSvgExit(previousSvg, {
        snapshot: exitSnapshot,
        speed: props.transition?.speed,
        sharedSnapshot: previousSharedSnapshot,
      });
    } else {
      host.replaceChildren(svg);
    }
    refreshRenderedSvgExitSnapshot(renderedSvg, svg);
    scheduleEnterAnimation(renderedSvg);
  }, [
    props.align,
    props.className,
    props.hover,
    props.maxWidth,
    props.outline,
    props.size,
    props.style,
    props.transition?.enter,
    props.transition?.exit,
    props.transition?.speed,
    props.sharedId,
    props.text,
  ]);

  useLayoutEffect(() => {
    const pending = pendingScatterRef.current;
    if (pending) pending.cancelled = true;

    return () => {
      const transition = latestTransitionRef.current;
      const renderedSvg = renderedSvgRef.current;
      const svg = renderedSvg?.svg ?? svgRef.current;
      if (!svg) return;
      cancelPendingEnter();
      const sharedSnapshot = captureSharedSnapshot(renderedSvg ?? undefined);
      if (transition?.exit !== "scatter") return;
      const exitSnapshot = pickSvgExitSnapshot(
        svg,
        renderedSvg?.exitSnapshot,
      );

      const nextPending = { cancelled: false };
      pendingScatterRef.current = nextPending;
      const runExit = () => {
        if (
          !nextPending.cancelled &&
          !wasSharedMotionSnapshotConsumed(sharedSnapshot)
        ) {
          animateSvgExit(svg, {
            snapshot: exitSnapshot,
            speed: transition.speed,
          });
        }
        if (pendingScatterRef.current === nextPending) {
          pendingScatterRef.current = null;
        }
      };
      if (sharedSnapshot) {
        queueMicrotask(() => queueMicrotask(runExit));
      } else {
        queueMicrotask(runExit);
      }
    };
  }, [props.transition?.exit]);

  return <span ref={hostRef} aria-label={props.text} />;
}
