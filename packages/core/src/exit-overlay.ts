import {
  prepareShardAnimation,
  type ShardAnimationHandle,
  type ShardAnimationOptions,
} from "./animation";

export type SvgExitSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string;
};

export type PreparedSvgExit = {
  overlay: SVGSVGElement;
  animation: ShardAnimationHandle;
};

export function captureSvgExitSnapshot(
  svg: SVGSVGElement,
): SvgExitSnapshot {
  const rect = svg.getBoundingClientRect();
  const computedStyle =
    svg.ownerDocument.defaultView?.getComputedStyle(svg);

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

function setOptionalStyleProperty(
  svg: SVGSVGElement,
  name: string,
  value: string | undefined,
): void {
  if (value) svg.style.setProperty(name, value);
}

export function prepareSvgExit(
  sourceSvg: SVGSVGElement,
  snapshot: SvgExitSnapshot,
  options: Omit<ShardAnimationOptions, "type">,
): PreparedSvgExit | null {
  const body = sourceSvg.ownerDocument.body;
  if (!body) return null;

  const overlay = sourceSvg.cloneNode(true) as SVGSVGElement;
  overlay.dataset.yuragiExit = "true";
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
  setOptionalStyleProperty(overlay, "color", snapshot.color);
  setOptionalStyleProperty(overlay, "fill", snapshot.fill);
  setOptionalStyleProperty(overlay, "stroke", snapshot.stroke);
  setOptionalStyleProperty(
    overlay,
    "stroke-width",
    snapshot.strokeWidth,
  );
  body.append(overlay);

  try {
    return {
      overlay,
      animation: prepareShardAnimation(overlay, {
        type: "scatter",
        ...options,
      }),
    };
  } catch (cause) {
    overlay.remove();
    throw cause;
  }
}
