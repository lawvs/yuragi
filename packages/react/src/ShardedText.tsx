import * as React from "react";
import {
  animateShards,
  createShardedSvg,
  layoutShardedText,
  type ShardHoverOptions,
  type ShardTransitionOptions,
  type TextOutline,
} from "@type-shards/core";

export type ShardedTextProps = {
  text: string;
  outline?: TextOutline;
  sharedId?: string;
  size?: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
  hover?: "none" | "outline" | ShardHoverOptions;
  transition?: ShardTransitionOptions;
  fallback?: "text" | "hidden" | "error";
  className?: string;
  style?: React.CSSProperties;
};

const unitlessStyleProperties = new Set([
  "animationIterationCount",
  "aspectRatio",
  "borderImageOutset",
  "borderImageSlice",
  "borderImageWidth",
  "boxFlex",
  "boxFlexGroup",
  "boxOrdinalGroup",
  "columnCount",
  "columns",
  "fillOpacity",
  "flex",
  "flexGrow",
  "flexPositive",
  "flexShrink",
  "flexNegative",
  "flexOrder",
  "floodOpacity",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnSpan",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowSpan",
  "gridRowStart",
  "lineClamp",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "scale",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
  "tabSize",
  "widows",
  "zIndex",
  "zoom",
  "WebkitAnimationIterationCount",
  "WebkitAspectRatio",
  "WebkitBoxFlex",
  "WebkitBoxFlexGroup",
  "WebkitBoxOrdinalGroup",
  "WebkitColumnCount",
  "WebkitColumns",
  "WebkitFlex",
  "WebkitFlexGrow",
  "WebkitFlexPositive",
  "WebkitFlexShrink",
  "WebkitFlexNegative",
  "WebkitFlexOrder",
  "WebkitLineClamp",
  "WebkitLineHeight",
  "WebkitOpacity",
  "WebkitOrder",
  "WebkitScale",
  "WebkitTabSize",
  "WebkitZoom",
  "msAnimationIterationCount",
  "msAspectRatio",
  "msBoxFlex",
  "msBoxFlexGroup",
  "msBoxOrdinalGroup",
  "msColumnCount",
  "msColumns",
  "msFlex",
  "msFlexGrow",
  "msFlexPositive",
  "msFlexShrink",
  "msFlexNegative",
  "msFlexOrder",
  "msGridColumn",
  "msGridColumnEnd",
  "msGridColumnSpan",
  "msGridColumnStart",
  "msGridRow",
  "msGridRowEnd",
  "msGridRowSpan",
  "msGridRowStart",
  "msLineClamp",
  "msLineHeight",
  "msOpacity",
  "msOrder",
  "msScale",
  "msTabSize",
  "msZoom",
]);

function kebabCaseStyleName(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function serializeStyleValue(name: string, value: string | number): string {
  if (
    typeof value === "number" &&
    value !== 0 &&
    !unitlessStyleProperties.has(name)
  ) {
    return `${value}px`;
  }
  return String(value);
}

function applySvgStyle(svg: SVGSVGElement, style: React.CSSProperties): void {
  for (const [name, value] of Object.entries(style) as Array<
    [string, string | number | null | undefined]
  >) {
    if (value == null) continue;
    if (name.startsWith("--")) {
      svg.style.setProperty(name, String(value));
      continue;
    }
    svg.style.setProperty(
      kebabCaseStyleName(name),
      serializeStyleValue(name, value),
    );
  }
}

function createTextFallbackStyle(
  props: Required<Pick<ShardedTextProps, "size">> &
    Pick<ShardedTextProps, "align" | "maxWidth" | "style">,
): React.CSSProperties {
  return {
    display: "block",
    fontSize: props.size,
    lineHeight: 1.2,
    maxWidth: props.maxWidth,
    textAlign: props.align,
    ...props.style,
  };
}

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
  props: Required<Pick<ShardedTextProps, "text" | "size" | "fallback">> &
    Omit<ShardedTextProps, "text" | "size" | "fallback">,
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

type SvgExitSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
};

function captureSvgExitSnapshot(svg: SVGSVGElement): SvgExitSnapshot {
  const rect = svg.getBoundingClientRect();
  const computedStyle = svg.ownerDocument.defaultView?.getComputedStyle(svg);

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    color: computedStyle?.getPropertyValue("color"),
    fill: computedStyle?.getPropertyValue("fill"),
    stroke: computedStyle?.getPropertyValue("stroke"),
    strokeWidth: computedStyle?.getPropertyValue("stroke-width"),
  };
}

function hasVisibleSvgSnapshot(snapshot: SvgExitSnapshot): boolean {
  return snapshot.width > 0 && snapshot.height > 0;
}

function pickSvgExitSnapshot(
  svg: SVGSVGElement,
  fallback: SvgExitSnapshot | undefined,
): SvgExitSnapshot {
  const snapshot = captureSvgExitSnapshot(svg);
  return hasVisibleSvgSnapshot(snapshot) || !fallback ? snapshot : fallback;
}

function refreshRenderedSvgExitSnapshot(
  state: RenderedSvgState,
  svg: SVGSVGElement,
): void {
  const update = () => {
    const snapshot = captureSvgExitSnapshot(svg);
    if (hasVisibleSvgSnapshot(snapshot) || !state.exitSnapshot) {
      state.exitSnapshot = snapshot;
    }
  };
  update();
  svg.ownerDocument.defaultView?.requestAnimationFrame(() => {
    if (svg.isConnected) update();
  });
}

function setOptionalStyleProperty(
  svg: SVGSVGElement,
  name: string,
  value: string | undefined,
): void {
  if (value) svg.style.setProperty(name, value);
}

function createSvgExitOverlay(
  sourceSvg: SVGSVGElement,
  snapshot: SvgExitSnapshot,
): SVGSVGElement | null {
  const body = sourceSvg.ownerDocument.body;
  if (!body) return null;

  const overlay = sourceSvg.cloneNode(true) as SVGSVGElement;
  overlay.dataset.typeShardsExit = "true";
  overlay.setAttribute("aria-hidden", "true");
  overlay.removeAttribute("aria-label");

  overlay.style.position = "fixed";
  overlay.style.inset = "auto";
  overlay.style.left = `${snapshot.left}px`;
  overlay.style.top = `${snapshot.top}px`;
  overlay.style.width = `${snapshot.width}px`;
  overlay.style.height = `${snapshot.height}px`;
  overlay.style.maxWidth = "none";
  overlay.style.margin = "0";
  overlay.style.display = "block";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "2147483647";
  overlay.style.transform = "none";
  overlay.style.transformOrigin = "0 0";
  overlay.style.setProperty("view-transition-name", "none");
  setOptionalStyleProperty(overlay, "color", snapshot.color);
  setOptionalStyleProperty(overlay, "fill", snapshot.fill);
  setOptionalStyleProperty(overlay, "stroke", snapshot.stroke);
  setOptionalStyleProperty(overlay, "stroke-width", snapshot.strokeWidth);

  body.append(overlay);
  return overlay;
}

function animateSvgExit(
  sourceSvg: SVGSVGElement,
  snapshot = captureSvgExitSnapshot(sourceSvg),
): void {
  const overlay = createSvgExitOverlay(sourceSvg, snapshot);
  const animatedSvg = overlay ?? sourceSvg;

  void animateShards(animatedSvg, { type: "scatter" }).finally(() => {
    overlay?.remove();
  });
}

function ShardedSvg({
  props,
}: {
  props: Required<Pick<ShardedTextProps, "text" | "size" | "fallback">> &
    Omit<ShardedTextProps, "text" | "size" | "fallback">;
}) {
  const hostRef = React.useRef<HTMLSpanElement>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const renderedSvgRef = React.useRef<RenderedSvgState | null>(null);
  const pendingScatterRef = React.useRef<{ cancelled: boolean } | null>(null);

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
      hover:
        props.hover === "outline" ||
        (typeof props.hover === "object" && props.hover.mode === "outline")
          ? "outline"
          : "none",
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
      animateSvgExit(previousSvg, exitSnapshot);
    } else {
      host.replaceChildren(svg);
    }
    refreshRenderedSvgExitSnapshot(renderedSvg, svg);

    if (props.transition?.enter === "settle") {
      void animateShards(svg, { type: "settle", stagger: "by-x" });
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
    props.text,
  ]);

  React.useLayoutEffect(() => {
    const pending = pendingScatterRef.current;
    if (pending) pending.cancelled = true;

    return () => {
      if (props.transition?.exit !== "scatter") return;
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
          animateSvgExit(svg, exitSnapshot);
        }
        if (pendingScatterRef.current === nextPending) {
          pendingScatterRef.current = null;
        }
      });
    };
  }, [props.transition?.exit]);

  return <span ref={hostRef} aria-label={props.text} />;
}

export function ShardedText(input: ShardedTextProps) {
  const props = {
    size: 48,
    fallback: "text" as const,
    ...input,
  };

  const ViewTransition = (
    React as typeof React & {
      ViewTransition?: React.ComponentType<{
        name: string;
        children: React.ReactNode;
      }>;
    }
  ).ViewTransition;

  if (props.sharedId && !ViewTransition) {
    throw new Error(
      "type-shards v1 requires React Canary ViewTransition when sharedId is set",
    );
  }

  let content: React.ReactNode;

  if (!props.outline) {
    if (props.fallback === "hidden") return null;
    if (props.fallback === "error") {
      throw new Error(`Missing type-shards outline for "${props.text}"`);
    }
    content = (
      <span className={props.className} style={createTextFallbackStyle(props)}>
        {props.text}
      </span>
    );
  } else {
    content = <ShardedSvg props={props} />;
  }

  if (props.sharedId && ViewTransition) {
    return <ViewTransition name={props.sharedId}>{content}</ViewTransition>;
  }

  return content;
}
