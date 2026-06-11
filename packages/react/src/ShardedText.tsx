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

function ShardedSvg({
  props,
}: {
  props: Required<Pick<ShardedTextProps, "text" | "size" | "fallback">> &
    Omit<ShardedTextProps, "text" | "size" | "fallback">;
}) {
  const hostRef = React.useRef<HTMLSpanElement>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const pendingScatterRef = React.useRef<{ cancelled: boolean } | null>(null);

  React.useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !props.outline) return;

    host.replaceChildren();
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
    host.append(svg);

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
  ]);

  React.useEffect(() => {
    const pending = pendingScatterRef.current;
    if (pending) pending.cancelled = true;

    return () => {
      if (props.transition?.exit !== "scatter") return;
      const svg = svgRef.current;
      if (!svg) return;

      const nextPending = { cancelled: false };
      pendingScatterRef.current = nextPending;
      queueMicrotask(() => {
        if (!nextPending.cancelled) {
          void animateShards(svg, { type: "scatter" });
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
      <span className={props.className} style={props.style}>
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
