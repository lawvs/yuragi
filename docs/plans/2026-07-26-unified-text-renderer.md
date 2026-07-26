# Unified Yuragi Text Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Replace core's three-stage public DOM rendering API with
`renderYuragiText()` and a lifecycle handle that owns enter playback, animated
removal, cancellation, disposal, and target replacement.

**Architecture:** Keep layout, SVG generation, and shard animation as focused
internal modules. Add a renderer module as the public seam and move the
viewport-fixed exit overlay from React into core. React and the playground
consume only the renderer handle; the compiler and WASM entry remain
unchanged.

**Tech Stack:** TypeScript 6, DOM/SVG, Web Animations API, Vitest with jsdom,
React 19, pnpm workspaces, tsdown.

## Global Constraints

- Implement the approved interface in
  `docs/design/2026-07-26-render-yuragi-text.md` without compatibility exports
  for the old rendering API.
- Keep `TextOutline`, the compiler data format, `createYuragiFont()`, and
  `@yuragi-labs/core/wasm` unchanged.
- Do not add pause, resume, seeking, replay, progress events, or native
  `Animation` access.
- Prepare settle animation before replacing target content.
- `finished` and `remove()` promises never reject.
- Invalid caller input throws synchronously without changing the target or its
  current handle.
- Operational animation failures leave readable content and resolve to a
  `failed` result.
- Do not inject styles; retain `style.css` and `YURAGI_STYLE_TEXT`.
- Preserve the public API of `@yuragi-labs/react`.
- Do not edit `tegami/` or add a changelog entry.
- Do not modify the separate `lawvs.github.io` repository in this branch.

---

## File Map

- Create `packages/core/src/render.ts`: public types, validation, target
  ownership, enter lifecycle, removal lifecycle, and handle implementation.
- Create `packages/core/src/exit-overlay.ts`: capture viewport/style state,
  build the fixed clone, and prepare internal scatter animation.
- Create `packages/core/test/render.test.ts`: public enter, validation,
  ownership, accessibility, owner-document, and failure tests.
- Create `packages/core/test/render-remove.test.ts`: exit overlay, inherited
  options, cancellation, concurrency, and disposal tests.
- Modify `packages/core/src/svg.ts`: construct every SVG node with an explicit
  owner document.
- Modify `packages/core/src/index.ts`: expose only the new renderer, core data
  types, and style text at the package root.
- Keep `packages/core/src/layout.ts` and `packages/core/src/animation.ts`
  internal and retain their direct unit tests.
- Rewrite `packages/react/src/ShardedSvg.tsx`: delegate rendering and exit
  cleanup to `YuragiTextHandle`.
- Delete `packages/react/src/animation-options.ts` and
  `packages/react/src/exit-overlay.ts`: their responsibilities move into core.
- Modify `packages/react/test/YuragiText.test.tsx` and
  `packages/react/test/runtime-transition.test.tsx`: mock the public renderer
  handle rather than core internals.
- Modify `apps/playground/src/shard-inspector/ShardPreview.tsx`: use a static
  renderer handle for inspection and public handle operations for playback.
- Modify `apps/playground/src/shard-inspector/ShardPreview.test.tsx`: verify
  renderer-handle cancellation/removal and static restoration.
- Modify `packages/core/README.md`: document the one-call renderer and delayed
  playback.
- Modify `scripts/release-smoke.mjs`: verify `renderYuragiText` and the absence
  of the old root exports.
- Create `packages/core/test/public-api.test.ts`: lock the intended root
  runtime surface.

---

### Task 1: Add the Public Enter Renderer

**Files:**

- Create: `packages/core/src/render.ts`
- Create: `packages/core/test/render.test.ts`
- Modify: `packages/core/src/svg.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes:
  `layoutShardedText(outline, { size, maxWidth, lineHeight, align })`,
  `createShardedSvg(layout, options, ownerDocument)`, and
  `prepareShardAnimation(svg, { type: "settle", speed, distance, stagger })`.
- Produces:
  `renderYuragiText(target, outline, options): YuragiTextHandle`,
  `RenderYuragiTextOptions`, `YuragiAnimationOptions`, `YuragiTextResult`,
  `YuragiTextHandle`, and `YuragiTextError`.

- [ ] **Step 1: Write failing tests for preparation, playback, static mode,
  accessibility, and owner-document creation**

Create `packages/core/test/render.test.ts` with a hoisted mock for
`prepareShardAnimation` and concrete handle helpers:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderYuragiText,
  YuragiTextError,
  type TextOutline,
  type YuragiTextResult,
} from "../src/index";
import type {
  ShardAnimationHandle,
  ShardAnimationResult,
} from "../src/animation";

const animationMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
}));

vi.mock("../src/animation", async () => {
  const actual = await vi.importActual<typeof import("../src/animation")>(
    "../src/animation",
  );
  return { ...actual, prepareShardAnimation: animationMocks.prepare };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function animationHandle(
  result: ShardAnimationResult | Promise<ShardAnimationResult> = {
    status: "completed",
  },
): ShardAnimationHandle {
  return {
    play: vi.fn(),
    cancel: vi.fn(),
    finished: Promise.resolve(result),
  };
}

const outline: TextOutline = {
  em: 1000,
  ascender: 800,
  descender: -200,
  groups: [{
    text: "A",
    advance: 500,
    breakAfter: true,
    glyphs: [{
      char: "A",
      advance: 500,
      bbox: { top: -800, bottom: 0, left: 0, right: 500 },
      shards: [{ path: "M0 0L500 0L500 500Z", direction: [1, 0] }],
    }],
  }],
};

beforeEach(() => {
  animationMocks.prepare.mockReset();
  animationMocks.prepare.mockImplementation(() => animationHandle());
});
```

Add tests with these exact assertions:

```ts
it("prepares off-DOM, mounts atomically, and autoplays defaults", () => {
  const target = document.createElement("div");
  target.textContent = "fallback";
  let connectedDuringPrepare = true;
  const prepared = animationHandle();
  animationMocks.prepare.mockImplementation((root: SVGSVGElement) => {
    connectedDuringPrepare = root.isConnected;
    expect(target.textContent).toBe("fallback");
    return prepared;
  });

  const handle = renderYuragiText(target, outline, { size: 72 });

  expect(connectedDuringPrepare).toBe(false);
  expect(target.firstElementChild).toBe(handle.element);
  expect(prepared.play).toHaveBeenCalledOnce();
  expect(animationMocks.prepare).toHaveBeenCalledWith(handle.element, {
    type: "settle",
    speed: 1,
    distance: 100,
    stagger: "by-x",
  });
});

it("mounts the prepared frame and waits when autoplay is false", () => {
  const prepared = animationHandle();
  animationMocks.prepare.mockReturnValue(prepared);
  const target = document.createElement("div");
  const handle = renderYuragiText(target, outline, {
    size: 48,
    animation: { autoplay: false },
  });

  expect(target.firstElementChild).toBe(handle.element);
  expect(prepared.play).not.toHaveBeenCalled();
  handle.play();
  handle.play();
  expect(prepared.play).toHaveBeenCalledOnce();
});

it("renders statically without preparing animation", async () => {
  const target = document.createElement("div");
  const handle = renderYuragiText(target, outline, {
    size: 48,
    animation: false,
  });

  expect(animationMocks.prepare).not.toHaveBeenCalled();
  await expect(handle.finished).resolves.toEqual({
    status: "skipped",
    reason: "disabled",
  });
});

it("derives, overrides, and hides the accessible label", () => {
  const target = document.createElement("div");
  expect(
    renderYuragiText(target, outline, { size: 48, animation: false })
      .element.getAttribute("aria-label"),
  ).toBe("A");
  expect(
    renderYuragiText(target, outline, {
      size: 48,
      ariaLabel: "Title",
      animation: false,
    }).element.getAttribute("aria-label"),
  ).toBe("Title");
  const hidden = renderYuragiText(target, outline, {
    size: 48,
    ariaLabel: false,
    animation: false,
  }).element;
  expect(hidden.getAttribute("aria-hidden")).toBe("true");
  expect(hidden.hasAttribute("aria-label")).toBe(false);
});

it("creates SVG nodes in the target ownerDocument", () => {
  const otherDocument = document.implementation.createHTMLDocument("other");
  const target = otherDocument.createElement("div");
  const handle = renderYuragiText(target, outline, {
    size: 48,
    animation: false,
  });
  expect(handle.element.ownerDocument).toBe(otherDocument);
  expect(handle.element.querySelector("path")?.ownerDocument).toBe(
    otherDocument,
  );
});
```

- [ ] **Step 2: Run the focused test and confirm the API is missing**

Run:

```bash
pnpm --filter @yuragi-labs/core exec vitest run test/render.test.ts
```

Expected: FAIL because `renderYuragiText` and its public types do not exist.

- [ ] **Step 3: Add the public types, error class, validation, SVG construction,
  and enter handle**

In `packages/core/src/svg.ts`, pass a document through every SVG element
creation:

```ts
function svgEl<K extends keyof SVGElementTagNameMap>(
  ownerDocument: Document,
  tag: K,
): SVGElementTagNameMap[K] {
  return ownerDocument.createElementNS(SVG_NS, tag);
}

export function createShardedSvg(
  layout: ShardedTextLayout,
  options: SvgOptions = {},
  ownerDocument: Document = document,
): SVGSVGElement {
  const svg = svgEl(ownerDocument, "svg");
  // Use svgEl(ownerDocument, tag) for every descendant.
}
```

Create `packages/core/src/render.ts` with the approved public declarations:

```ts
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
  ariaLabel?: string | false;
  animation?: false | YuragiAnimationOptions;
};

export type YuragiTextResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | {
      status: "skipped";
      reason: "disabled" | "reduced-motion" | "unsupported" | "empty";
    }
  | { status: "failed"; error: YuragiTextError };

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
  readonly finished: Promise<YuragiTextResult>;
  play(): void;
  cancel(): void;
  remove(
    options?: Omit<YuragiAnimationOptions, "autoplay">,
  ): Promise<YuragiTextResult>;
  dispose(): void;
}
```

Implement renderer validation before calling layout:

```ts
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
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
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
}
```

Resolve animation defaults to `{ autoplay: true, speed: 1, distance: 100,
stagger: "by-x" }`. Map internal results without rejection:

```ts
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
    (cause) => ({ status: "failed", error: new YuragiTextError(phase, cause) }),
  );
}
```

Implement a private `RendererHandle` and
`WeakMap<Element, RendererHandle>`. Construct layout, SVG, label, and prepared
settle handle before reading or cancelling the existing target owner. During
the commit phase call the old owner's private replacement method, replace the
children, register the new owner, and autoplay. Make `play()` single-use,
`cancel()` restore the assembled SVG through the internal handle's
  `cancel()`, and keep `remove()` as an incremental `Promise.resolve({
status: "cancelled" })` until Task 2.

Export the renderer alongside the existing exports temporarily:

```ts
export * from "./animation";
export * from "./layout";
export * from "./render";
export * from "./style-text";
export * from "./svg";
export * from "./types";
```

- [ ] **Step 4: Add validation, replacement, result, and stale-handle tests**

Append exact cases that assert:

```ts
it.each([
  [{ size: 0 }, "size"],
  [{ size: Number.NaN }, "size"],
  [{ size: 48, maxWidth: Number.POSITIVE_INFINITY }, "maxWidth"],
  [{ size: 48, lineHeight: -1 }, "lineHeight"],
] as const)("rejects invalid options before target mutation", (options, field) => {
  const target = document.createElement("div");
  target.textContent = "unchanged";
  expect(() => renderYuragiText(target, outline, options)).toThrow(field);
  expect(target.textContent).toBe("unchanged");
  expect(animationMocks.prepare).not.toHaveBeenCalled();
});

it("cancels the previous same-target owner without letting it affect the replacement", () => {
  const firstAnimation = animationHandle();
  const secondAnimation = animationHandle();
  animationMocks.prepare
    .mockReturnValueOnce(firstAnimation)
    .mockReturnValueOnce(secondAnimation);
  const target = document.createElement("div");
  const first = renderYuragiText(target, outline, { size: 48 });
  const second = renderYuragiText(target, outline, { size: 64 });

  expect(firstAnimation.cancel).toHaveBeenCalledOnce();
  first.cancel();
  first.dispose();
  expect(target.firstElementChild).toBe(second.element);
});

it.each([
  { status: "skipped", reason: "empty" },
  { status: "skipped", reason: "reduced-motion" },
  { status: "skipped", reason: "unsupported" },
] satisfies YuragiTextResult[])("preserves $status/$reason enter results", async (result) => {
  animationMocks.prepare.mockReturnValue(animationHandle(result));
  const handle = renderYuragiText(document.createElement("div"), outline, {
    size: 48,
  });
  await expect(handle.finished).resolves.toEqual(result);
});

it("maps internal failures to an enter YuragiTextError", async () => {
  const cause = new Error("native playback failed");
  animationMocks.prepare.mockReturnValue(animationHandle({
    status: "failed",
    error: { cause } as never,
  }));
  const handle = renderYuragiText(document.createElement("div"), outline, {
    size: 48,
  });
  const result = await handle.finished;
  expect(result.status).toBe("failed");
  if (result.status === "failed") {
    expect(result.error).toBeInstanceOf(YuragiTextError);
    expect(result.error.phase).toBe("enter");
    expect(result.error.cause).toBe(cause);
  }
});
```

- [ ] **Step 5: Run core renderer and existing internal-stage tests**

Run:

```bash
pnpm --filter @yuragi-labs/core exec vitest run test/render.test.ts test/layout.test.ts test/svg.test.ts test/animation.test.ts
pnpm --filter @yuragi-labs/core typecheck
```

Expected: all selected tests PASS and core typecheck exits 0.

- [ ] **Step 6: Commit the enter renderer**

```bash
git add packages/core/src/index.ts packages/core/src/render.ts packages/core/src/svg.ts packages/core/test/render.test.ts
git commit -m "feat(core): add unified text renderer"
```

---

### Task 2: Add Animated Removal and Disposal

**Files:**

- Create: `packages/core/src/exit-overlay.ts`
- Create: `packages/core/test/render-remove.test.ts`
- Modify: `packages/core/src/render.ts`

**Interfaces:**

- Consumes: Task 1's `RendererHandle`, resolved enter options, and internal
  `prepareShardAnimation()`.
- Produces: idempotent `handle.remove(options?)`,
  phase-aware `handle.cancel()`, and synchronous idempotent `handle.dispose()`.

- [ ] **Step 1: Write failing removal tests**

Create `packages/core/test/render-remove.test.ts` with these imports, fixtures,
and hoisted animation mock:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderYuragiText,
  YuragiTextError,
  type TextOutline,
} from "../src/index";
import type {
  ShardAnimationHandle,
  ShardAnimationOptions,
  ShardAnimationResult,
} from "../src/animation";

const animationMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
}));

vi.mock("../src/animation", async () => {
  const actual = await vi.importActual<typeof import("../src/animation")>(
    "../src/animation",
  );
  return { ...actual, prepareShardAnimation: animationMocks.prepare };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function animationHandle(
  result: ShardAnimationResult | Promise<ShardAnimationResult> = {
    status: "completed",
  },
): ShardAnimationHandle {
  return {
    play: vi.fn(),
    cancel: vi.fn(),
    finished: Promise.resolve(result),
  };
}

const outline: TextOutline = {
  em: 1000,
  ascender: 800,
  descender: -200,
  groups: [{
    text: "A",
    advance: 500,
    breakAfter: true,
    glyphs: [{
      char: "A",
      advance: 500,
      bbox: { top: -800, bottom: 0, left: 0, right: 500 },
      shards: [{ path: "M0 0L500 0L500 500Z", direction: [1, 0] }],
    }],
  }],
};

beforeEach(() => {
  animationMocks.prepare.mockReset();
  animationMocks.prepare.mockImplementation(
    (_root: SVGSVGElement, _options: ShardAnimationOptions) =>
      animationHandle(),
  );
});
```

Add these concrete scenarios:

```ts
it("removes the owned SVG, animates a fixed clone, and allows a replacement", async () => {
  const scatter = deferred<ShardAnimationResult>();
  animationMocks.prepare.mockImplementation((_root, options) =>
    options.type === "scatter"
      ? animationHandle(scatter.promise)
      : animationHandle(),
  );
  const target = document.createElement("div");
  document.body.append(target);
  const first = renderYuragiText(target, outline, {
    size: 48,
    animation: false,
  });
  first.element.style.color = "rgb(1, 2, 3)";
  first.element.getBoundingClientRect = vi.fn(() => ({
    left: 12, top: 18, width: 90, height: 40,
    right: 102, bottom: 58, x: 12, y: 18, toJSON: () => ({}),
  } as DOMRect));

  const removal = first.remove();
  const overlay = document.querySelector<SVGSVGElement>("[data-yuragi-exit]");
  expect(target.children).toHaveLength(0);
  expect(overlay?.parentElement).toBe(document.body);
  expect(overlay?.style.cssText).toContain("position: fixed");
  expect(overlay?.style.left).toBe("12px");
  expect(overlay?.style.top).toBe("18px");
  expect(overlay?.style.width).toBe("90px");
  expect(overlay?.style.height).toBe("40px");
  expect(overlay?.style.color).toBe("rgb(1, 2, 3)");

  const second = renderYuragiText(target, outline, {
    size: 64,
    animation: false,
  });
  expect(target.firstElementChild).toBe(second.element);
  scatter.resolve({ status: "completed" });
  await expect(removal).resolves.toEqual({ status: "completed" });
  expect(overlay?.isConnected).toBe(false);
  expect(target.firstElementChild).toBe(second.element);
});

it("inherits enter options, applies removal overrides, and reuses its promise", () => {
  const target = document.createElement("div");
  document.body.append(target);
  const handle = renderYuragiText(target, outline, {
    size: 48,
    animation: {
      autoplay: false,
      speed: 0.8,
      distance: 80,
      stagger: "none",
    },
  });
  const first = handle.remove({ distance: 120 });
  const second = handle.remove({ speed: 2 });
  expect(second).toBe(first);
  expect(animationMocks.prepare).toHaveBeenLastCalledWith(
    expect.any(SVGSVGElement),
    {
      type: "scatter",
      speed: 0.8,
      distance: 120,
      stagger: "none",
    },
  );
});

it("cancel removes an active exit overlay and resolves removal as cancelled", async () => {
  const target = document.createElement("div");
  document.body.append(target);
  const scatterHandle = animationHandle(new Promise(() => undefined));
  animationMocks.prepare.mockImplementation((_root, options) =>
    options.type === "scatter" ? scatterHandle : animationHandle(),
  );
  const handle = renderYuragiText(target, outline, {
    size: 48,
    animation: false,
  });
  const removal = handle.remove();
  handle.cancel();
  expect(scatterHandle.cancel).toHaveBeenCalledOnce();
  expect(document.querySelector("[data-yuragi-exit]")).toBeNull();
  await expect(removal).resolves.toEqual({ status: "cancelled" });
});

it("dispose is immediate, idempotent, and never removes newer content", () => {
  const target = document.createElement("div");
  const first = renderYuragiText(target, outline, {
    size: 48,
    animation: false,
  });
  const second = renderYuragiText(target, outline, {
    size: 64,
    animation: false,
  });
  first.dispose();
  first.dispose();
  expect(target.firstElementChild).toBe(second.element);
  second.dispose();
  expect(target.children).toHaveLength(0);
});
```

Also add table-driven cleanup tests for scatter results `completed`, all three
`skipped` reasons, and `failed`, asserting that the overlay is removed and a
failed result contains `YuragiTextError` with `phase === "exit"`.

- [ ] **Step 2: Run removal tests and confirm `remove()` has no exit
  lifecycle**

Run:

```bash
pnpm --filter @yuragi-labs/core exec vitest run test/render-remove.test.ts
```

Expected: FAIL because no overlay is created and the removal lifecycle is not
implemented.

- [ ] **Step 3: Move exit overlay preparation into core**

Create `packages/core/src/exit-overlay.ts` with:

```ts
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

export function prepareSvgExit(
  sourceSvg: SVGSVGElement,
  options: Omit<ShardAnimationOptions, "type">,
): PreparedSvgExit | null;
```

Implement `prepareSvgExit()` by:

1. reading `getBoundingClientRect()` and computed `color`, `fill`, `stroke`,
   and `stroke-width`;
2. returning `null` when `sourceSvg.ownerDocument.body` is unavailable;
3. cloning the SVG, setting `data-yuragi-exit`, `aria-hidden`, fixed viewport
   coordinates, `pointer-events: none`, and `z-index: 2147483647`;
4. appending the clone to that document's body;
5. preparing `{ type: "scatter", ...options }` on the connected clone;
6. removing the clone and rethrowing if preparation unexpectedly throws.

Do not export this module from `packages/core/src/index.ts`.

- [ ] **Step 4: Implement removal, cancellation, ownership release, and
  disposal in `RendererHandle`**

Track `disposed`, `replaced`, `exitAnimation`, `exitOverlay`, and a cached
`removal` promise. Implement the lifecycle with these exact rules:

```ts
remove(options = {}) {
  if (this.removal) return this.removal;
  if (this.disposed || this.replaced) {
    return Promise.resolve({ status: "cancelled" });
  }

  this.enterAnimation?.cancel();
  const exitOptions = {
    speed: options.speed ?? this.animation.speed,
    distance: options.distance ?? this.animation.distance,
    stagger: options.stagger ?? this.animation.stagger,
  };

  let prepared: PreparedSvgExit | null = null;
  try {
    prepared = prepareSvgExit(this.element, exitOptions);
  } catch (cause) {
    this.releaseAndRemoveOwnedElement();
    return (this.removal = Promise.resolve({
      status: "failed",
      error: new YuragiTextError("exit", cause),
    }));
  }

  this.releaseAndRemoveOwnedElement();
  if (!prepared) {
    return (this.removal = Promise.resolve({
      status: "skipped",
      reason: "unsupported",
    }));
  }

  const deferred = createDeferred<YuragiTextResult>();
  this.removal = deferred.promise;
  this.resolveRemoval = once(deferred.resolve);
  this.exitAnimation = prepared.animation;
  this.exitOverlay = prepared.overlay;
  prepared.animation.play();
  void mapAnimationFinished("exit", prepared.animation.finished)
    .then((result) => this.finishExit(prepared, result));
  return this.removal;
}
```

Add these private helpers so `cancel()` and `dispose()` can finish a removal
even when a test double's `finished` promise never settles:

```ts
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function once<T>(resolve: (value: T) => void): (value: T) => void {
  let settled = false;
  return (value) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };
}

private finishExit(
  prepared: PreparedSvgExit,
  result: YuragiTextResult,
): void {
  prepared.animation.cancel();
  prepared.overlay.remove();
  if (this.exitAnimation === prepared.animation) {
    this.exitAnimation = null;
    this.exitOverlay = null;
  }
  this.resolveRemoval?.(result);
}

private cancelExit(): void {
  this.exitAnimation?.cancel();
  this.exitOverlay?.remove();
  this.exitAnimation = null;
  this.exitOverlay = null;
  this.resolveRemoval?.({ status: "cancelled" });
}
```

Ensure only the current target owner releases the target registry.

- [ ] **Step 5: Run all core tests and typecheck**

Run:

```bash
pnpm --filter @yuragi-labs/core test
pnpm --filter @yuragi-labs/core typecheck
```

Expected: all core tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit removal lifecycle**

```bash
git add packages/core/src/exit-overlay.ts packages/core/src/render.ts packages/core/test/render-remove.test.ts
git commit -m "feat(core): add animated text removal"
```

---

### Task 3: Migrate the React Adapter

**Files:**

- Modify: `packages/react/src/ShardedSvg.tsx`
- Delete: `packages/react/src/animation-options.ts`
- Delete: `packages/react/src/exit-overlay.ts`
- Modify: `packages/react/test/YuragiText.test.tsx`
- Modify: `packages/react/test/runtime-transition.test.tsx`

**Interfaces:**

- Consumes: `renderYuragiText()`, `YuragiTextHandle`, and `YuragiTextResult`.
- Produces: unchanged `YuragiText` props, fallback behavior, and completion
  callbacks.

- [ ] **Step 1: Replace React tests' internal animation mock with a public
  renderer mock**

In both React test files, mock `renderYuragiText`:

```ts
const coreMocks = vi.hoisted(() => ({
  renderYuragiText: vi.fn(),
}));

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return { ...actual, renderYuragiText: coreMocks.renderYuragiText };
});

function rendererHandle(
  target: Element,
  finished: YuragiTextResult | Promise<YuragiTextResult> = {
    status: "completed",
  },
): YuragiTextHandle {
  const element = target.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  element.dataset.yuragiRoot = "true";
  const handle: YuragiTextHandle = {
    element,
    finished: Promise.resolve(finished),
    play: vi.fn(),
    cancel: vi.fn(),
    remove: vi.fn(async () => ({ status: "completed" })),
    dispose: vi.fn(),
  };
  target.replaceChildren(element);
  return handle;
}
```

Default the mock to `rendererHandle(target)` in `beforeEach`. Update assertions
to verify:

- default rendering calls `renderYuragiText(host, outline, {
  size: 48, maxWidth: undefined, align: undefined, className: undefined,
  hover: "none", ariaLabel: false, animation: { autoplay: false,
  speed: undefined } })`;
- styles are applied before `handle.play()`;
- `animation: false` passes `animation: false`;
- outline replacement calls the old handle's `remove({ speed })` when exit is
  enabled and calls the new handle's `play()` when enter is enabled;
- completed/skipped enter and exit results invoke callbacks, while
  cancelled/failed results do not;
- unmount calls `remove({ speed })` when exit is enabled and `dispose()` when
  disabled;
- StrictMode leaves one mounted SVG, no exit overlay, and invokes each
  completion callback at most once.

Remove React assertions about fixed overlay coordinates and internal
`prepareShardAnimation` options because Task 2 now owns those contracts.

- [ ] **Step 2: Run React tests and confirm the adapter still imports removed
  responsibilities**

Run:

```bash
pnpm --filter @yuragi-labs/react test
```

Expected: FAIL because `ShardedSvg.tsx` still calls the three internal stages
and the mock `renderYuragiText` is unused.

- [ ] **Step 3: Rewrite `ShardedSvg.tsx` around the renderer handle**

Use:

```ts
type RenderedSvgState = {
  handle: YuragiTextHandle;
  outline: TextOutline;
  text: string;
  size: number;
  maxWidth?: number;
  align?: "start" | "center" | "end";
};
```

For a new layout:

1. call the previous handle's `remove({ speed })` before rendering the new
   title when exit is enabled;
2. call `renderYuragiText(host, props.outline, ...)` with `ariaLabel: false`
   and enter animation configured as `{ autoplay: false, speed }`, or `false`;
3. call `applySvgStyle(handle.element, props.style)` before `handle.play()`;
4. store the new handle and observe `handle.finished`;
5. invoke `onEnterComplete` only for `completed` or `skipped`;
6. invoke `onExitComplete` only for `completed` or `skipped`.

Retain `useEffectEvent` for the latest committed callbacks. Use an empty-array
layout-effect lifetime guard: on cleanup, synchronously start `remove()` (or
`dispose()` when exit is disabled); if StrictMode immediately reactivates the
effect, dispose that pending handle, clear the rendered state, and let the
render effect install a fresh handle before paint.

For same-layout rerenders, only apply the latest style and keep the existing
handle. Render the host as:

```tsx
return <span ref={hostRef} aria-label={props.text} />;
```

- [ ] **Step 4: Delete React-only animation and overlay modules**

Delete:

```bash
packages/react/src/animation-options.ts
packages/react/src/exit-overlay.ts
```

Confirm no source import remains:

```bash
rg -n "animation-options|exit-overlay|prepareShardAnimation|createShardedSvg|layoutShardedText" packages/react/src
```

Expected: no matches.

- [ ] **Step 5: Run React tests and typecheck**

Run:

```bash
pnpm --filter @yuragi-labs/react test
pnpm --filter @yuragi-labs/react typecheck
```

Expected: all React tests PASS and typecheck exits 0.

- [ ] **Step 6: Commit the React migration**

```bash
git add packages/react/src/ShardedSvg.tsx packages/react/src/animation-options.ts packages/react/src/exit-overlay.ts packages/react/test/YuragiText.test.tsx packages/react/test/runtime-transition.test.tsx
git commit -m "refactor(react): use core text renderer"
```

---

### Task 4: Migrate the Playground Inspector

**Files:**

- Modify: `apps/playground/src/shard-inspector/ShardPreview.tsx`
- Modify: `apps/playground/src/shard-inspector/ShardPreview.test.tsx`

**Interfaces:**

- Consumes: `renderYuragiText()` and `YuragiTextHandle`.
- Produces: unchanged inspector modes, shard selection, settle button, and
  scatter button.

- [ ] **Step 1: Rewrite the inspector test around public handles**

Mock `renderYuragiText` and return a real minimal SVG containing one
`data-shard-motion` group and path. Add tests asserting:

```ts
expect(coreMocks.renderYuragiText).toHaveBeenCalledWith(
  expect.any(HTMLSpanElement),
  data.outline,
  {
    size: 220,
    ariaLabel: data.char,
    animation: false,
  },
);
```

For a settle playback, return a new handle and assert its `play()` is called.
For a scatter playback, assert the current handle's
`remove({ distance: playback.distance })` is called. Resolve that removal and
assert another static `renderYuragiText(..., animation: false)` restores the
inspector. On data/mode replacement and component unmount, assert abandoned
handles receive `dispose()`.

- [ ] **Step 2: Run the focused inspector test and confirm old stage calls**

Run:

```bash
pnpm --filter @yuragi-labs/playground exec vitest run src/shard-inspector/ShardPreview.test.tsx
```

Expected: FAIL because the inspector still imports and calls the old stages.

- [ ] **Step 3: Render and play through public handles**

In `ShardPreview.tsx`, replace `svgRef` and `activeAnimationRef` with:

```ts
const renderedRef = useRef<YuragiTextHandle | null>(null);
const playbackRef = useRef<YuragiTextHandle | null>(null);
```

Create a local `decorateSvg(svg)` function that preserves the existing
inspector shard indices, selected state, fill/stroke colors, and exploded
transforms.

For data/mode/selection changes:

```ts
playbackRef.current?.dispose();
renderedRef.current?.dispose();
const handle = renderYuragiText(host, data.outline, {
  size: 220,
  ariaLabel: data.char,
  animation: false,
});
handle.element.classList.add("inspector-glyph-svg");
decorateSvg(handle.element);
renderedRef.current = handle;
```

For settle playback, render a fresh handle with
`animation: { autoplay: false, distance, stagger: "by-x" }`, decorate its
element, store it as both current and playback, then call `play()`.

For scatter playback, call the current handle's `remove({ distance })`; after
the non-rejecting removal settles, restore a static handle only if that
playback is still current. Dispose current handles in layout-effect cleanup.

- [ ] **Step 4: Run inspector tests, playground tests, and typecheck**

Run:

```bash
pnpm --filter @yuragi-labs/playground exec vitest run src/shard-inspector/ShardPreview.test.tsx
pnpm --filter @yuragi-labs/playground test
pnpm --filter @yuragi-labs/playground typecheck
```

Expected: all selected and playground tests PASS; typecheck exits 0.

- [ ] **Step 5: Commit the playground migration**

```bash
git add apps/playground/src/shard-inspector/ShardPreview.tsx apps/playground/src/shard-inspector/ShardPreview.test.tsx
git commit -m "refactor(playground): use core text renderer"
```

---

### Task 5: Close the Legacy Public Surface and Document the New API

**Files:**

- Create: `packages/core/test/public-api.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/README.md`
- Modify: `packages/core/package.json`
- Modify: `scripts/release-smoke.mjs`

**Interfaces:**

- Consumes: all migrated consumers from Tasks 3 and 4.
- Produces: the final root package surface containing renderer APIs, outline
  types, style text, and no stage-specific rendering exports.

- [ ] **Step 1: Write a failing public-surface regression test**

Create `packages/core/test/public-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as core from "../src/index";

describe("@yuragi-labs/core public surface", () => {
  it("exports the unified renderer instead of internal stages", () => {
    expect(core.renderYuragiText).toBeTypeOf("function");
    expect(core.YuragiTextError).toBeTypeOf("function");
    expect(core.YURAGI_STYLE_TEXT).toBeTypeOf("string");
    expect(core).not.toHaveProperty("layoutShardedText");
    expect(core).not.toHaveProperty("createShardedSvg");
    expect(core).not.toHaveProperty("prepareShardAnimation");
    expect(core).not.toHaveProperty("ShardAnimationError");
  });
});
```

- [ ] **Step 2: Run the test and confirm legacy exports remain**

Run:

```bash
pnpm --filter @yuragi-labs/core exec vitest run test/public-api.test.ts
```

Expected: FAIL because the old stage values are still root exports.

- [ ] **Step 3: Narrow the root index**

Replace `packages/core/src/index.ts` with:

```ts
export {
  renderYuragiText,
  YuragiTextError,
  type RenderYuragiTextOptions,
  type YuragiAnimationOptions,
  type YuragiTextHandle,
  type YuragiTextResult,
} from "./render";
export * from "./style-text";
export * from "./types";
```

Do not delete internal layout, SVG, or animation files or their tests.

- [ ] **Step 4: Rewrite the core README example**

Replace the three-stage animation section with:

```ts
import { renderYuragiText } from "@yuragi-labs/core";

const title = renderYuragiText(host, outline, {
  size: 72,
  maxWidth: 900,
});

const result = await title.finished;
if (result.status === "failed") {
  console.error(result.error);
}
```

Document `animation: false`, `{ autoplay: false }` plus `play()`, all result
statuses, `remove()`, `cancel()`, `dispose()`, accessibility labels, and the
requirement to include `@yuragi-labs/core/style.css`. Keep the WASM section
unchanged.

Update the package description to:

```json
"description": "Core types, DOM renderer, styles, and runtime WASM compiler for Yuragi text effects."
```

- [ ] **Step 5: Update the release tarball smoke check**

Replace the core renderer assertion with:

```js
["@yuragi-labs/core#renderYuragiText", core.renderYuragiText],
```

After the function loop, add:

```js
for (const removed of [
  "layoutShardedText",
  "createShardedSvg",
  "prepareShardAnimation",
  "ShardAnimationError",
]) {
  if (removed in core) {
    throw new Error(`@yuragi-labs/core must not export ${removed}`);
  }
}
```

- [ ] **Step 6: Verify no product source consumes legacy root exports**

Run:

```bash
rg -n "layoutShardedText|createShardedSvg|prepareShardAnimation|ShardAnimationError|ShardAnimationHandle|ShardAnimationResult" packages/*/src apps/playground/src scripts --glob '!packages/core/src/layout.ts' --glob '!packages/core/src/svg.ts' --glob '!packages/core/src/animation.ts' --glob '!packages/core/src/render.ts' --glob '!packages/core/src/exit-overlay.ts'
```

Expected: no matches.

- [ ] **Step 7: Run the public test, build, smoke check, and full verification**

Run:

```bash
pnpm --filter @yuragi-labs/core exec vitest run test/public-api.test.ts
pnpm build
node scripts/check-release.mts
pnpm test
pnpm typecheck
pnpm playground:build
```

Expected: public API test PASS; all packages build; release check installs the
packed packages in a temporary consumer and its smoke script prints
`Release tarball smoke test passed.`; all tests and typechecks pass; playground
production build exits 0.

- [ ] **Step 8: Inspect the final diff and confirm tegami is untouched**

Run:

```bash
git diff --stat 12eb569
git diff --check 12eb569
git status --short
git diff --name-only 12eb569 -- tegami
```

Expected: no whitespace errors and the final command prints no paths.

- [ ] **Step 9: Commit the public surface and documentation**

```bash
git add packages/core/src/index.ts packages/core/test/public-api.test.ts packages/core/README.md packages/core/package.json scripts/release-smoke.mjs
git commit -m "refactor(core): replace staged rendering api"
```
