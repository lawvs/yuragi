import { animateShards } from "@yuragi/core";
import { createScatterAnimationOptions } from "./animation-options";

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

export function pickSvgExitSnapshot(
  svg: SVGSVGElement,
  fallback: SvgExitSnapshot | undefined,
): SvgExitSnapshot {
  const snapshot = captureSvgExitSnapshot(svg);
  return hasVisibleSvgSnapshot(snapshot) || !fallback ? snapshot : fallback;
}

export function refreshRenderedSvgExitSnapshot(
  state: { exitSnapshot?: SvgExitSnapshot },
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
  overlay.style.setProperty("view-transition-name", "none");
  setOptionalStyleProperty(overlay, "color", snapshot.color);
  setOptionalStyleProperty(overlay, "fill", snapshot.fill);
  setOptionalStyleProperty(overlay, "stroke", snapshot.stroke);
  setOptionalStyleProperty(overlay, "stroke-width", snapshot.strokeWidth);

  body.append(overlay);
  return overlay;
}

export function animateSvgExit(
  sourceSvg: SVGSVGElement,
  options: {
    snapshot?: SvgExitSnapshot;
    speed?: number;
  } = {},
): void {
  const snapshot = options.snapshot ?? captureSvgExitSnapshot(sourceSvg);
  const overlay = createSvgExitOverlay(sourceSvg, snapshot);
  const animatedSvg = overlay ?? sourceSvg;

  void animateShards(
    animatedSvg,
    createScatterAnimationOptions(options.speed),
  ).finally(() => {
    overlay?.remove();
  });
}
