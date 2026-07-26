# Unified Yuragi Text Renderer

Date: 2026-07-26
Status: Approved

## Context

`@yuragi-labs/core` currently asks DOM callers to assemble three public
functions:

```ts
const layout = layoutShardedText(outline, layoutOptions);
const svg = createShardedSvg(layout, svgOptions);
const animation = prepareShardAnimation(svg, animationOptions);

target.replaceChildren(svg);
animation.play();
```

These functions describe internal stages rather than the caller's goal.
Callers must understand the intermediate layout representation, the generated
SVG's private `data-*` protocol, and the ordering requirement that animation
preparation happen before DOM insertion. The ordering requirement has already
caused a visible complete-title flash in the blog integration.

The stages remain useful Implementation modules with focused tests, but their
composition should be owned by core. The public Interface should express one
operation: render Yuragi text into a target and return a controllable lifecycle
handle.

There are no released consumers that require compatibility with the current
core rendering Interface. This design deliberately replaces it. It does not
redesign runtime font compilation or the `@yuragi-labs/core/wasm` entry.

## Goals

- Give ordinary DOM callers a one-call rendering path.
- Preserve delayed playback for Swup and framework Adapters.
- Prepare the settle animation before replacing target content.
- Centralize target ownership, stale-handle safety, and animation cleanup.
- Preserve React's settle-enter and scatter-exit behavior.
- Keep the blog's fallback, loading budget, transition gate, and responsive
  rerendering behavior while removing its renderer-specific coordination.
- Retain the existing pure layout, SVG generation, and animation tests behind
  the public Interface.

## Non-goals

- Changing `TextOutline` or the font compiler data format.
- Moving `createYuragiFont()` out of the WASM entry.
- Managing font loading, fallback text, Swup state, or ResizeObserver policy in
  core.
- Adding pause, resume, seeking, replay, progress events, or native
  `Animation` access.
- Preserving the old rendering exports.

## Public Interface

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

export function renderYuragiText(
  target: Element,
  outline: TextOutline,
  options: RenderYuragiTextOptions,
): YuragiTextHandle;
```

The primary path is one synchronous call:

```ts
const title = renderYuragiText(target, outline, {
  size: 72,
  maxWidth: 900,
});
```

The function performs layout, creates the SVG in `target.ownerDocument`,
prepares the settle animation, atomically replaces the target's children, and
starts playback before returning.

## Defaults

When `animation` is omitted, the renderer uses:

```ts
{
  autoplay: true,
  speed: 1,
  distance: 100,
  stagger: "by-x",
}
```

`animation: false` mounts a static SVG. Its `finished` promise immediately
resolves to:

```ts
{ status: "skipped", reason: "disabled" }
```

The existing layout defaults remain:

- `lineHeight`: `size * 1.2`
- `align`: `"start"`
- no maximum width when `maxWidth` is omitted

## Delayed Enter Playback

`autoplay: false` is the advanced escape hatch required by page transitions
and framework Adapters:

```ts
const title = renderYuragiText(target, outline, {
  size: 72,
  animation: {
    autoplay: false,
    stagger: "by-x",
  },
});

await transitionReady;
title.play();
```

The SVG is already mounted at the prepared settle frame. `finished` remains
pending until `play()`, `cancel()`, `remove()`, `dispose()`, or target
replacement reaches a terminal state.

`play()` is single-use and idempotent. Calling it after autoplay has started,
after completion, or after any other terminal state does nothing.

## Target Ownership and Replacement

Core tracks the current handle for each target.

Before mutating a target, `renderYuragiText()` validates the input, computes
layout, creates the complete SVG, and prepares its initial animation off-DOM.
If any caller or rendering error throws during this phase, the target and its
current handle remain unchanged.

After successful preparation, replacement is atomic:

1. cancel the current handle that still owns the target;
2. replace the target's children with the new prepared SVG;
3. transfer target ownership to the new handle;
4. start playback when autoplay is enabled.

A stale handle never owns a newer SVG. Its later completion, cancellation, or
`dispose()` cannot remove or modify the replacement.

Calling `remove()` releases target ownership as soon as it removes the original
SVG. This permits a new settle render to begin in the target while the old
title's scatter overlay continues independently.

## Enter Results

`finished` describes only the initial settle lifecycle and resolves exactly
once. It never rejects.

- `completed`: every enter animation completed.
- `cancelled`: enter was cancelled by the caller, removal, disposal, or target
  replacement before completion.
- `skipped / disabled`: `animation` was `false`.
- `skipped / reduced-motion`: the target's window prefers reduced motion.
- `skipped / unsupported`: the generated shards cannot use the Web Animations
  API.
- `skipped / empty`: the outline generated no animatable shards.
- `failed`: animation preparation or playback failed unexpectedly.

Cancelling enter animation restores the assembled base SVG, so animation
failure or cancellation never leaves unreadable scattered text.

## Animated Removal

`remove()` immediately captures the SVG's viewport position and computed visual
styles, cancels any unfinished enter animation, creates a fixed overlay clone,
removes the owned SVG, and starts a scatter animation:

```ts
const result = await title.remove({
  speed: 1,
  distance: 100,
  stagger: "by-x",
});
```

When an option is omitted, removal inherits the handle's resolved enter speed,
distance, and stagger. It does not expose an autoplay option because removal
always starts immediately.

The returned promise never rejects and uses the same `YuragiTextResult` union.
Every terminal path removes the overlay. A failed or unsupported exit still
removes the original title and cleans up the overlay.

Calling `remove()` again returns the first removal promise. Calling it after
`dispose()` resolves as `cancelled`.

`cancel()` cancels whichever animation is currently active. During enter it
keeps the assembled SVG mounted. During exit it removes the overlay and resolves
the removal as `cancelled`.

## Immediate Disposal

`dispose()` is synchronous and idempotent. It:

1. cancels any active enter or exit animation;
2. removes this handle's SVG or overlay;
3. releases target ownership if this handle still owns the target;
4. resolves pending enter and removal work as `cancelled`.

It never clears or modifies content installed by a newer handle.

## Validation and Operational Failure

Caller and rendering errors throw synchronously before target mutation:

- `size` must be finite and greater than zero.
- `maxWidth`, when provided, must be finite and greater than zero.
- `lineHeight`, when provided, must be finite and greater than zero.
- outline metrics and advances used by layout must be finite, with `em` greater
  than zero.
- a breakable group wider than `maxWidth` remains a layout error.
- SVG construction errors remain rendering errors.

Operational animation failures do not throw. They restore readable base
content, resolve the relevant result as `failed`, and preserve the browser
error as `YuragiTextError.cause`.

## Accessibility and Styles

When `ariaLabel` is omitted, core reconstructs the text from the outline groups
and gives the SVG that accessible label. A string overrides the derived label.
`ariaLabel: false` marks the SVG `aria-hidden="true"` for callers that retain a
separate accessible text node, including the React and blog Adapters.

Callers must continue to include `@yuragi-labs/core/style.css` exactly once, or
use `YURAGI_STYLE_TEXT` through an Adapter such as `YuragiStyles`. Rendering does
not inject styles because stylesheet ownership and CSP nonce policy belong to
the caller.

## Internal Modules

The existing stages remain separate internal Modules:

- layout: `TextOutline` to positioned lines and groups;
- SVG: positioned layout to stable SVG DOM;
- animation: shard keyframes, timing, preparation, and handle state;
- exit overlay: visual snapshot, cloning, scatter, and cleanup;
- renderer: validation, target ownership, stage composition, and the public
  handle.

The renderer provides the public Seam. Internal tests may import the stage
Modules directly, but they are not package exports.

## Removed Public Exports

The following values are no longer exported:

```ts
layoutShardedText
createShardedSvg
prepareShardAnimation
ShardAnimationError
```

The following stage-specific types are no longer exported:

```ts
LayoutOptions
LayoutGroup
LayoutLine
ShardedTextLayout
SvgOptions
ShardAnimationOptions
ShardAnimationResult
ShardAnimationHandle
```

They are replaced by:

```ts
renderYuragiText
RenderYuragiTextOptions
YuragiAnimationOptions
YuragiTextHandle
YuragiTextResult
YuragiTextError
```

## Package and Consumer Impact

### `@yuragi-labs/core`

This is an intentional breaking change. The root Interface becomes smaller and
deeper. The CSS, outline data types, and WASM subpath remain unchanged.

### `@yuragi-labs/react`

The public React Interface remains unchanged. Its internal renderer uses
`renderYuragiText()` for settle entry and `handle.remove()` for scatter exit.
The exit overlay Implementation moves from React into core.

### `@yuragi-labs/compiler`

No change. It depends on outline bundle types, not DOM rendering.

### Playground

The inspector renders with `animation: false` and uses `handle.element` for
advanced shard inspection. Settle playback uses a new animated render. Scatter
playback calls `remove()` and restores a static render after the removal result,
rather than querying core's private animation protocol.

### lawvs blog

The Svelte component keeps:

- the singleton runtime font;
- the 300 ms enhancement budget;
- the Swup opacity gate and timeout;
- fallback state;
- responsive sizing and ResizeObserver;
- failure fallback and component cleanup.

It removes manual layout, SVG creation, animation preparation, DOM replacement,
one-frame reveal workarounds, and renderer-specific initial animation
coordination. It renders with `autoplay: false`, calls `play()` when the Swup
gate opens, and calls `dispose()` during component cleanup.

The Svelte component's `text` prop and the blog's Astro usage remain unchanged.

## Verification

Internal stage tests continue to cover wrapping, positioning, SVG structure,
keyframes, timing, atomic preparation, and native animation failures.

Public renderer tests must verify:

1. the settle frame is applied before target replacement;
2. default autoplay and delayed `play()`;
3. static rendering and every skipped reason;
4. invalid input leaves the target and current handle unchanged;
5. same-target rendering cancels the previous owner;
6. stale completion, cancellation, and disposal cannot affect newer content;
7. enter cancellation and failure leave assembled readable SVG;
8. animated removal snapshots styles, permits concurrent replacement, and
   cleans its overlay on every terminal path;
9. `remove()` and `dispose()` idempotence;
10. derived, explicit, and hidden accessibility modes;
11. DOM creation and motion policy use `target.ownerDocument`;
12. React's public behavior and callbacks remain unchanged;
13. the blog retains its budget, transition gate, fallback, responsive rerender,
    and cleanup behavior after migration.
