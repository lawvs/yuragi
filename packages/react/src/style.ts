import type { CSSProperties } from "react";
import type { YuragiTextProps } from "./types";

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

export function applySvgStyle(
  svg: SVGSVGElement,
  style: CSSProperties,
): void {
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

export function createTextFallbackStyle(
  props: Required<Pick<YuragiTextProps, "size">> &
    Pick<YuragiTextProps, "align" | "maxWidth" | "style">,
): CSSProperties {
  return {
    display: "block",
    fontSize: props.size,
    lineHeight: 1.2,
    maxWidth: props.maxWidth,
    textAlign: props.align,
    ...props.style,
  };
}
