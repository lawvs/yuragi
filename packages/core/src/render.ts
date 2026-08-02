import {
  prepareShardAnimation,
  type ShardAnimationHandle,
  type ShardAnimationResult,
} from "./animation";
import {
  captureSvgExitSnapshot,
  prepareSvgExit,
  type PreparedSvgExit,
} from "./exit-overlay";
import { layoutShardedText } from "./layout";
import { createShardedSvg } from "./svg";
import type { TextOutline } from "./types";

export type YuragiAnimationOptions = {
  autoplay?: boolean;
  speed?: number;
  distance?: number;
  stagger?: "none" | "by-x";
};

export type RenderYuragiTextOptions = {
  size: number;
  maxWidth?: number;
  lineHeight?: number;
  align?: "start" | "center" | "end";
  className?: string;
  hover?: "none" | "outline";
  hoverMotion?: boolean;
  ariaLabel?: string | false;
  animation?: false | YuragiAnimationOptions;
};

export type YuragiTextResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | {
      status: "skipped";
      reason:
        | "disabled"
        | "reduced-motion"
        | "unsupported"
        | "empty";
    }
  | {
      status: "failed";
      error: YuragiTextError;
    };

export class YuragiTextError extends Error {
  readonly phase: "enter" | "exit";
  override readonly cause: unknown;

  constructor(phase: "enter" | "exit", cause: unknown) {
    super(`Yuragi text animation failed during ${phase}`, { cause });
    this.name = "YuragiTextError";
    this.phase = phase;
    this.cause = cause;
  }
}

export interface YuragiTextHandle {
  readonly element: SVGSVGElement;

  play(): Promise<YuragiTextResult>;
  cancel(): void;
  remove(
    options?: Omit<YuragiAnimationOptions, "autoplay">,
  ): Promise<YuragiTextResult>;
  dispose(): void;
}

type ResolvedAnimationOptions = Required<YuragiAnimationOptions>;

const DEFAULT_ANIMATION: ResolvedAnimationOptions = {
  autoplay: true,
  speed: 1,
  distance: 100,
  stagger: "by-x",
};

const targetOwners = new WeakMap<Element, RendererHandle>();

function positiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and greater than zero`);
  }
}

function validateRenderInput(
  outline: TextOutline,
  options: RenderYuragiTextOptions,
): void {
  positiveFinite("size", options.size);
  if (options.maxWidth !== undefined) {
    positiveFinite("maxWidth", options.maxWidth);
  }
  if (options.lineHeight !== undefined) {
    positiveFinite("lineHeight", options.lineHeight);
  }
  positiveFinite("outline.em", outline.em);

  for (const [name, value] of [
    ["outline.ascender", outline.ascender],
    ["outline.descender", outline.descender],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${name} must be finite`);
    }
  }

  outline.groups.forEach((group, groupIndex) => {
    if (!Number.isFinite(group.advance)) {
      throw new RangeError(
        `outline.groups[${groupIndex}].advance must be finite`,
      );
    }
    group.glyphs.forEach((glyph, glyphIndex) => {
      if (!Number.isFinite(glyph.advance)) {
        throw new RangeError(
          `outline.groups[${groupIndex}].glyphs[${glyphIndex}].advance must be finite`,
        );
      }
    });
  });

  if (options.animation !== false) {
    validateAnimationOptions(options.animation);
  }
}

function validateAnimationOptions(
  options:
    | Omit<YuragiAnimationOptions, "autoplay">
    | YuragiAnimationOptions
    | undefined,
): void {
  const speed = options?.speed;
  if (
    speed !== undefined &&
    (!Number.isFinite(speed) || speed <= 0)
  ) {
    throw new RangeError("speed must be finite and greater than zero");
  }
  const distance = options?.distance;
  if (
    distance !== undefined &&
    (!Number.isFinite(distance) || distance < 0)
  ) {
    throw new RangeError("distance must be finite and non-negative");
  }
}

function resolveAnimation(
  options: YuragiAnimationOptions | undefined,
): ResolvedAnimationOptions {
  return {
    autoplay: options?.autoplay ?? DEFAULT_ANIMATION.autoplay,
    speed: options?.speed ?? DEFAULT_ANIMATION.speed,
    distance: options?.distance ?? DEFAULT_ANIMATION.distance,
    stagger: options?.stagger ?? DEFAULT_ANIMATION.stagger,
  };
}

function mapAnimationResult(
  phase: "enter" | "exit",
  result: ShardAnimationResult,
): YuragiTextResult {
  if (result.status !== "failed") return result;
  return {
    status: "failed",
    error: new YuragiTextError(phase, result.error.cause),
  };
}

function mapAnimationFinished(
  phase: "enter" | "exit",
  finished: Promise<ShardAnimationResult>,
): Promise<YuragiTextResult> {
  return finished.then(
    (result) => mapAnimationResult(phase, result),
    (cause: unknown) => ({
      status: "failed",
      error: new YuragiTextError(phase, cause),
    }),
  );
}

class RendererHandle implements YuragiTextHandle {
  private readonly playback: Promise<YuragiTextResult>;
  private disposed = false;
  private removal: Promise<YuragiTextResult> | null = null;
  private exit: PreparedSvgExit | null = null;

  constructor(
    private readonly target: Element,
    readonly element: SVGSVGElement,
    private readonly enterAnimation: ShardAnimationHandle | null,
    initialResult: YuragiTextResult | undefined,
    readonly animation: ResolvedAnimationOptions,
  ) {
    this.playback = initialResult
      ? Promise.resolve(initialResult)
      : enterAnimation
        ? mapAnimationFinished("enter", enterAnimation.finished)
        : Promise.resolve({ status: "skipped", reason: "disabled" });
  }

  play(): Promise<YuragiTextResult> {
    if (!this.disposed) this.enterAnimation?.play();
    return this.playback;
  }

  cancel(): void {
    if (this.disposed) return;
    if (this.exit) {
      this.cancelExit();
      return;
    }
    this.enterAnimation?.cancel();
  }

  remove(
    options: Omit<YuragiAnimationOptions, "autoplay"> = {},
  ): Promise<YuragiTextResult> {
    if (this.removal) return this.removal;
    if (this.disposed) {
      this.removal = Promise.resolve({ status: "cancelled" });
      return this.removal;
    }
    validateAnimationOptions(options);

    let snapshot;
    try {
      snapshot = captureSvgExitSnapshot(this.element);
    } catch (cause) {
      this.enterAnimation?.cancel();
      this.releaseOwnedElement();
      this.removal = Promise.resolve({
        status: "failed",
        error: new YuragiTextError("exit", cause),
      });
      return this.removal;
    }

    this.enterAnimation?.cancel();
    const exitOptions = {
      speed: options.speed ?? this.animation.speed,
      distance: options.distance ?? this.animation.distance,
      stagger: options.stagger ?? this.animation.stagger,
    };
    let prepared: PreparedSvgExit | null;
    try {
      prepared = prepareSvgExit(
        this.element,
        snapshot,
        exitOptions,
      );
    } catch (cause) {
      this.releaseOwnedElement();
      this.removal = Promise.resolve({
        status: "failed",
        error: new YuragiTextError("exit", cause),
      });
      return this.removal;
    }

    this.releaseOwnedElement();
    if (!prepared) {
      this.removal = Promise.resolve({
        status: "skipped",
        reason: "unsupported",
      });
      return this.removal;
    }

    this.exit = prepared;
    this.removal = mapAnimationFinished(
      "exit",
      prepared.animation.finished,
    ).then((result) => this.finishExit(prepared, result));
    prepared.animation.play();
    return this.removal;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.exit) this.cancelExit();
    else this.enterAnimation?.cancel();
    this.releaseOwnedElement();
  }

  supersede(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enterAnimation?.cancel();
  }

  private finishExit(
    prepared: PreparedSvgExit,
    result: YuragiTextResult,
  ): YuragiTextResult {
    if (this.exit === prepared) {
      this.exit = null;
      prepared.animation.cancel();
    }
    prepared.overlay.remove();
    return result;
  }

  private cancelExit(): void {
    const exit = this.exit;
    this.exit = null;
    exit?.animation.cancel();
    exit?.overlay.remove();
  }

  private releaseOwnedElement(): void {
    if (targetOwners.get(this.target) === this) {
      targetOwners.delete(this.target);
    }
    if (this.element.parentNode === this.target) {
      this.element.remove();
    }
  }
}

function applyAccessibleName(
  svg: SVGSVGElement,
  outline: TextOutline,
  ariaLabel: string | false | undefined,
): void {
  if (ariaLabel === false) {
    svg.setAttribute("aria-hidden", "true");
    return;
  }
  svg.setAttribute(
    "aria-label",
    ariaLabel ?? outline.groups.map((group) => group.text).join(""),
  );
}

export function renderYuragiText(
  target: Element,
  outline: TextOutline,
  options: RenderYuragiTextOptions,
): YuragiTextHandle {
  validateRenderInput(outline, options);

  const layout = layoutShardedText(outline, {
    size: options.size,
    maxWidth: options.maxWidth,
    lineHeight: options.lineHeight,
    align: options.align,
  });
  const svg = createShardedSvg(
    layout,
    {
      className: options.className,
      hover: options.hover,
      hoverMotion: options.hoverMotion,
    },
    target.ownerDocument,
  );
  applyAccessibleName(svg, outline, options.ariaLabel);

  const animation = resolveAnimation(
    options.animation === false ? undefined : options.animation,
  );
  let enterAnimation: ShardAnimationHandle | null = null;
  let initialResult: YuragiTextResult | undefined;

  if (options.animation === false) {
    initialResult = {
      status: "skipped",
      reason: "disabled",
    };
  } else {
    try {
      enterAnimation = prepareShardAnimation(svg, {
        type: "settle",
        speed: animation.speed,
        distance: animation.distance,
        stagger: animation.stagger,
      });
    } catch (cause) {
      initialResult = {
        status: "failed",
        error: new YuragiTextError("enter", cause),
      };
    }
  }

  const handle = new RendererHandle(
    target,
    svg,
    enterAnimation,
    initialResult,
    animation,
  );
  targetOwners.get(target)?.supersede();
  target.replaceChildren(svg);
  targetOwners.set(target, handle);

  if (options.animation !== false && animation.autoplay) {
    handle.play();
  }
  return handle;
}
