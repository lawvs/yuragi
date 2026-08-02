import { useEffectEvent, useLayoutEffect, useRef } from "react";
import {
  renderYuragiText,
  type TextOutline,
  type YuragiTextHandle,
  type YuragiTextResult,
} from "@yuragi-labs/core";
import { applySvgStyle } from "./style";
import type { ResolvedYuragiTextProps } from "./types";

type RenderedSvgState = {
  handle: YuragiTextHandle;
  outline: TextOutline;
  text: string;
  size: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
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

function completedOrSkipped(result: YuragiTextResult): boolean {
  return result.status === "completed" || result.status === "skipped";
}

function applyHoverEffects(
  svg: SVGSVGElement,
  props: ResolvedYuragiTextProps,
): void {
  if (props.hover === "outline") svg.dataset.hover = "outline";
  else delete svg.dataset.hover;

  if (props.hoverMotion ?? props.hover === "outline") {
    svg.dataset.hoverMotion = "true";
  } else {
    delete svg.dataset.hoverMotion;
  }
}

export function ShardedSvg({ props }: { props: ResolvedYuragiTextProps }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const renderedRef = useRef<RenderedSvgState | null>(null);
  const pendingUnmountRef = useRef<YuragiTextHandle | null>(null);
  const mountedRef = useRef(false);
  const notifyEnterComplete = useEffectEvent(() => {
    props.onEnterComplete?.();
  });
  const notifyExitComplete = useEffectEvent(() => {
    props.onExitComplete?.();
  });
  const removeForExit = useEffectEvent(
    (rendered: RenderedSvgState) => {
      void rendered.handle
        .remove({ speed: props.animation.speed })
        .then((result) => {
          if (completedOrSkipped(result)) notifyExitComplete();
        });
    },
  );
  const cleanupCurrent = useEffectEvent(() => {
    mountedRef.current = false;
    const rendered = renderedRef.current;
    if (!rendered) return;

    pendingUnmountRef.current = rendered.handle;
    if (props.animation.exit) removeForExit(rendered);
    else rendered.handle.dispose();
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    const pending = pendingUnmountRef.current;
    if (pending) {
      pendingUnmountRef.current = null;
      pending.dispose();
      if (renderedRef.current?.handle === pending) {
        renderedRef.current = null;
      }
    }
    return cleanupCurrent;
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !props.outline) return;

    const current = renderedRef.current;
    if (
      hasSameSvgLayout(current, props) &&
      current?.handle.element.parentElement === host
    ) {
      applyHoverEffects(current.handle.element, props);
      if (props.style) {
        applySvgStyle(current.handle.element, props.style);
      }
      return;
    }

    if (
      current?.handle.element.parentElement === host &&
      props.animation.exit
    ) {
      removeForExit(current);
    }

    const handle = renderYuragiText(host, props.outline, {
      size: props.size,
      maxWidth: props.maxWidth,
      align: props.align,
      className: props.className,
      hover: props.hover === "outline" ? "outline" : "none",
      hoverMotion: props.hoverMotion,
      ariaLabel: false,
      animation: props.animation.enter
        ? {
            autoplay: false,
            speed: props.animation.speed,
          }
        : false,
    });
    applyHoverEffects(handle.element, props);
    if (props.style) {
      applySvgStyle(handle.element, props.style);
    }

    const rendered: RenderedSvgState = {
      handle,
      outline: props.outline,
      text: props.text,
      size: props.size,
      maxWidth: props.maxWidth,
      align: props.align,
    };
    renderedRef.current = rendered;

    void handle.play().then((result) => {
      if (
        mountedRef.current &&
        renderedRef.current === rendered &&
        completedOrSkipped(result)
      ) {
        notifyEnterComplete();
      }
    });
  }, [
    props.align,
    props.animation.enter,
    props.animation.exit,
    props.animation.speed,
    props.className,
    props.hover,
    props.hoverMotion,
    props.maxWidth,
    props.outline,
    props.size,
    props.style,
    props.text,
  ]);

  return <span ref={hostRef} aria-label={props.text} />;
}
