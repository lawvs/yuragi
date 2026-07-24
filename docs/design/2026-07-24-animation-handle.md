# Controllable Shard Animation Handle

Date: 2026-07-24
Status: Approved

## Context

`@yuragi-labs/core` currently exposes:

```ts
animateShards(root, options): Promise<void>
```

That Interface starts playback immediately and erases every terminal outcome.
Callers cannot prepare the initial visual frame before mounting an SVG, delay
playback until a page transition is ready, cancel stale work, or distinguish
completion from reduced-motion fallback, unsupported browsers, cancellation,
and runtime failure.

The missing prepare phase is visible in the blog integration: a settle SVG can
be painted in its complete state before the first animation frame is installed.
The blog has compensated with its own controller, which duplicates lifecycle
logic that belongs in Yuragi.

There are no released consumers that require compatibility with the current
animation Interface, so this change deliberately replaces it.

## Decision

Replace `animateShards()` with one synchronous preparation function returning a
single-use handle:

```ts
export type ShardAnimationOptions = {
  type: "settle" | "scatter";
  speed?: number;
  distance?: number;
  stagger?: "none" | "by-x";
};

export type ShardAnimationResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | {
      status: "skipped";
      reason: "reduced-motion" | "unsupported" | "empty";
    }
  | {
      status: "failed";
      error: ShardAnimationError;
    };

export class ShardAnimationError extends Error {
  readonly phase: "prepare" | "play";
  override readonly cause: unknown;
}

export interface ShardAnimationHandle {
  play(): void;
  cancel(): void;
  readonly finished: Promise<ShardAnimationResult>;
}

export function prepareShardAnimation(
  root: ParentNode,
  options: ShardAnimationOptions,
): ShardAnimationHandle;
```

`play()` returns `void`; the stable `finished` property observes every terminal
path, including cancellation before playback. The handle intentionally omits
pause, resume, replay, seeking, playback-rate mutation, progress events, and
native `Animation` access because the existing React and blog Adapters do not
need them.

## Lifecycle

`prepareShardAnimation()` validates options before mutating any shard. It then
synchronously:

1. captures the current `[data-shard-motion]` elements;
2. resolves reduced-motion and WAAPI support from the root's owning document;
3. computes keyframes and timings;
4. creates every native animation;
5. pauses every native animation at time zero before returning.

For settle animations, this applies the dispersed initial frame before the
browser can paint. The safe mounting sequence is therefore:

```ts
const animation = prepareShardAnimation(svg, {
  type: "settle",
  stagger: "by-x",
});

host.replaceChildren(svg);
animation.play();

const result = await animation.finished;
```

The handle has these logical transitions:

```text
prepared ──play──> running ──native completion──> completed
    │                 │
    └────cancel───────┴─────────────────────────> cancelled

prepare ──policy/environment────────────────────> skipped
prepare/running ──WAAPI exception/rejection─────> failed
```

`play()` and `cancel()` are idempotent. Calling `play()` after a terminal result
does nothing. Calling `cancel()` after completion may release retained native
effects and restore the SVG's base appearance, but it does not replace the
already settled `completed` result.

Preparing a new animation for the same root cancels and releases the previous
handle. This rule centralizes overlapping-animation cleanup and stale completion
races.

## Result and Error Semantics

`finished` resolves exactly once and never rejects.

- `completed`: all captured shard animations completed normally.
- `cancelled`: the public handle was cancelled before completion.
- `skipped / empty`: the root contained no shard motion elements.
- `skipped / reduced-motion`: the owning window prefers reduced motion.
- `skipped / unsupported`: one or more captured shards cannot use WAAPI.
- `failed`: preparation or playback failed unexpectedly.

Invalid options are caller errors and throw synchronously:

- `speed` must be finite and greater than zero.
- `distance` must be finite and greater than or equal to zero.

Operational failures do not throw. `ShardAnimationError.phase` identifies
whether the failure occurred while creating the native animations or while
playing them, and `cause` preserves the browser error.

Preparation is atomic. If creating any native animation fails, Yuragi cancels
every animation already created for that handle and restores the base SVG
appearance. Playback is coordinated in the same way: one unexpected rejection
fails the handle and cancels the remaining animations. Rejections caused by the
handle's own `cancel()` resolve as `cancelled`, not `failed`.

Skipping, cancellation, and failure leave readable base content. A completed
settle animation may release its native effects because its final state equals
the assembled SVG. A completed scatter animation retains its final frame until
the caller removes the exit overlay, cancels the handle for cleanup, or prepares
another animation on the same root.

## Module Boundary

The public Module owns:

- shard discovery and dataset parsing;
- detached-SVG position fallback;
- keyframe and timing calculation;
- synchronous first-frame installation;
- reduced-motion policy;
- multi-shard atomicity;
- native completion aggregation;
- cancellation and cleanup;
- terminal-result classification;
- same-root replacement.

`buildShardKeyframes()`, `planShardTimings()`, their supporting types, and the
unused `direction` option become private Implementation details.

WAAPI remains behind a private in-process `AnimationDriver` Seam. The browser
Adapter wraps `Element.animate`, and tests use controlled stand-ins. Neither the
driver nor native `Animation` objects are exported.

This is a deep Module: a small Interface hides the browser lifecycle and
multi-element coordination. It also improves Locality because flash prevention,
browser fallback, cancellation races, and error classification can be changed
inside the core animation Module rather than in each framework or site Adapter.

## Adapter Migration

The React Adapter prepares a settle animation before replacing the host's
children, then starts it in the same layout effect. It stores the current handle
and cancels it during effect cleanup. Completion callbacks fire for `completed`
and `skipped`, but not for stale cancellation or failure.

The exit-overlay Adapter prepares and plays scatter, awaits `finished`, and
always removes the overlay. It reports lifecycle completion for `completed` and
`skipped`; cancellation prevents stale callbacks.

The playground prepares and plays directly and cancels the handle when its
effect is replaced.

The blog prepares the detached SVG before mounting it, waits for its existing
page-transition gate, and then calls `play()`. It can remove its custom animation
generation/controller logic because Yuragi owns cancellation and terminal
classification.
