import { useEffectEvent, useLayoutEffect, useRef } from "react";
import {
  animateShards,
  createShardedSvg,
  layoutShardedText,
  type TextOutline,
} from "@yuragi-labs/core";
import { createSettleAnimationOptions } from "./animation-options";
import {
  animateSvgExit,
  pickSvgExitSnapshot,
  refreshRenderedSvgExitSnapshot,
  type SvgExitSnapshot,
} from "./exit-overlay";
import { applySvgStyle } from "./style";
import type { ResolvedYuragiTextProps } from "./types";

type RenderedSvgState = {
  svg: SVGSVGElement;
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
  const mountedRef = useRef(false);
  const notifyEnterComplete = useEffectEvent(() => {
    props.onEnterComplete?.();
  });
  const notifyExitComplete = useEffectEvent(() => {
    props.onExitComplete?.();
  });
  const animateUnmountedSvgExit = useEffectEvent(() => {
    const transition = props.transition;
    if (transition?.exit !== "scatter") return;
    const renderedSvg = renderedSvgRef.current;
    const svg = renderedSvg?.svg ?? svgRef.current;
    if (!svg) return;
    const exitSnapshot = pickSvgExitSnapshot(
      svg,
      renderedSvg?.exitSnapshot,
    );

    const nextPending = { cancelled: false };
    pendingScatterRef.current = nextPending;
    queueMicrotask(() => {
      if (!nextPending.cancelled) {
        void animateSvgExit(svg, {
          snapshot: exitSnapshot,
          speed: transition.speed,
        }).then(() => notifyExitComplete());
      }
      if (pendingScatterRef.current === nextPending) {
        pendingScatterRef.current = null;
      }
    });
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !props.outline) return;

    const current = renderedSvgRef.current;
    if (hasSameSvgLayout(current, props)) {
      if (props.style && current) {
        applySvgStyle(current.svg, props.style);
        refreshRenderedSvgExitSnapshot(current, current.svg);
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

    if (shouldScatterPrevious && previousSvg) {
      const exitSnapshot = pickSvgExitSnapshot(
        previousSvg,
        previous?.exitSnapshot,
      );
      host.replaceChildren(svg);
      void animateSvgExit(previousSvg, {
        snapshot: exitSnapshot,
        speed: props.transition?.speed,
      }).then(() => notifyExitComplete());
    } else {
      host.replaceChildren(svg);
    }
    refreshRenderedSvgExitSnapshot(renderedSvg, svg);

    if (props.transition?.enter === "settle") {
      void animateShards(
        svg,
        createSettleAnimationOptions(props.transition.speed),
      ).then(() => {
        if (mountedRef.current && renderedSvgRef.current?.svg === svg) {
          notifyEnterComplete();
        }
      });
    }
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
    props.text,
  ]);

  useLayoutEffect(() => {
    const pending = pendingScatterRef.current;
    if (pending) pending.cancelled = true;

    return () => {
      animateUnmountedSvgExit();
    };
  }, [props.transition?.exit]);

  return <span ref={hostRef} aria-label={props.text} />;
}
