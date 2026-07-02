import * as React from "react";
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
  const hostRef = React.useRef<HTMLSpanElement>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const renderedSvgRef = React.useRef<RenderedSvgState | null>(null);
  const pendingScatterRef = React.useRef<{ cancelled: boolean } | null>(null);
  const latestTransitionRef = React.useRef(props.transition);
  latestTransitionRef.current = props.transition;

  React.useLayoutEffect(() => {
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
      animateSvgExit(previousSvg, {
        snapshot: exitSnapshot,
        speed: props.transition?.speed,
      });
    } else {
      host.replaceChildren(svg);
    }
    refreshRenderedSvgExitSnapshot(renderedSvg, svg);

    if (props.transition?.enter === "settle") {
      void animateShards(
        svg,
        createSettleAnimationOptions(props.transition.speed),
      );
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

  React.useLayoutEffect(() => {
    const pending = pendingScatterRef.current;
    if (pending) pending.cancelled = true;

    return () => {
      const transition = latestTransitionRef.current;
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
          animateSvgExit(svg, {
            snapshot: exitSnapshot,
            speed: transition.speed,
          });
        }
        if (pendingScatterRef.current === nextPending) {
          pendingScatterRef.current = null;
        }
      });
    };
  }, [props.transition?.exit]);

  return <span ref={hostRef} aria-label={props.text} />;
}
