# Controllable Shard Animation Handle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `subagent-driven-development` (recommended) or `executing-plans` to implement
> this plan task by task. Track progress with the checkboxes below.

**Goal:** Replace the immediate `Promise<void>` shard animation API with a
synchronously prepared, cancellable handle that reports explicit terminal
results.

**Architecture:** `@yuragi-labs/core` becomes the lifecycle-owning Module. Its
public Interface is `prepareShardAnimation()` plus a three-member handle; WAAPI,
timing, first-frame installation, rollback, and result classification remain in
the Implementation. React and playground code act as thin Adapters.

**Tech Stack:** TypeScript 6, Web Animations API, React 19, Vitest 4, jsdom,
pnpm workspaces.

## Global Constraints

- This is a breaking replacement; do not preserve `animateShards()`.
- `finished` resolves exactly once and never rejects.
- `prepareShardAnimation()` applies the initial animation frame synchronously
  before returning.
- `play()` and `cancel()` are idempotent.
- Do not add pause, replay, seek, reverse, progress, or public WAAPI access.
- Keep the WAAPI driver Seam private to `packages/core/src/animation.ts`.
- Remove the unused `direction` option.
- Keep the base SVG readable after skip, cancellation, or failure.

---

### Task 1: Define and test the core handle lifecycle

**Files:**

- Modify: `packages/core/src/animation.ts`
- Rewrite tests: `packages/core/test/animation.test.ts`

**Interfaces:**

- Produces:

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

- Removes: `AnimateShardsOptions`, `BuildShardKeyframesOptions`,
  `PlanShardTimingsOptions`, `ShardTiming`, `animateShards`,
  `buildShardKeyframes`, and `planShardTimings` from the public Interface.

- [ ] **Step 1: Replace helper-level tests with a controllable native animation fake**

At the top of `packages/core/test/animation.test.ts`, import only the public
Interface and define a fake that exposes native lifecycle controls:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  prepareShardAnimation,
  ShardAnimationError,
} from "../src/animation";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function nativeAnimation() {
  const completion = deferred<void>();
  return {
    animation: {
      currentTime: null,
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(),
      finished: completion.promise,
    } as unknown as Animation,
    completion,
  };
}

function shard(): SVGGElement {
  const element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  element.dataset.shardMotion = "true";
  element.dataset.directionX = "0.5";
  element.dataset.directionY = "-1";
  return element;
}

beforeEach(() => {
  Element.prototype.animate =
    vi.fn() as unknown as typeof Element.prototype.animate;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
});
```

- [ ] **Step 2: Write failing tests for synchronous preparation and explicit completion**

Add tests proving that preparation pauses at time zero, does not play early,
retains the existing keyframes/timing behavior, and resolves only after all
native animations finish:

```ts
it("prepares every shard at time zero before playback", async () => {
  const first = nativeAnimation();
  const second = nativeAnimation();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.append(shard(), shard());
  vi.mocked(Element.prototype.animate)
    .mockReturnValueOnce(first.animation)
    .mockReturnValueOnce(second.animation);

  const handle = prepareShardAnimation(svg, {
    type: "settle",
    distance: 80,
    stagger: "by-x",
  });

  expect(first.animation.pause).toHaveBeenCalledOnce();
  expect(first.animation.currentTime).toBe(0);
  expect(first.animation.play).not.toHaveBeenCalled();
  expect(Element.prototype.animate).toHaveBeenCalledWith(
    [
      {
        opacity: 0,
        transform: "translate(40px, -80px) scale(1.05)",
      },
      {},
    ],
    expect.objectContaining({
      duration: 500,
      easing: "cubic-bezier(0, 0, 0, 1)",
      fill: "both",
    }),
  );

  handle.play();
  handle.play();
  expect(first.animation.play).toHaveBeenCalledOnce();
  expect(second.animation.play).toHaveBeenCalledOnce();

  first.completion.resolve();
  await Promise.resolve();
  second.completion.resolve();
  await expect(handle.finished).resolves.toEqual({ status: "completed" });
});
```

- [ ] **Step 3: Run the focused test and verify that the old API fails it**

Run:

```bash
pnpm --filter @yuragi-labs/core test -- animation.test.ts
```

Expected: FAIL because `prepareShardAnimation` and `ShardAnimationError` are
not exported.

- [ ] **Step 4: Add failing tests for cancellation, skip reasons, validation, and atomic failure**

Cover each terminal branch through the public Interface:

```ts
it("cancels before play and settles once", async () => {
  const native = nativeAnimation();
  vi.mocked(Element.prototype.animate).mockReturnValue(native.animation);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.append(shard());

  const handle = prepareShardAnimation(svg, { type: "settle" });
  handle.cancel();
  handle.cancel();
  handle.play();

  expect(native.animation.cancel).toHaveBeenCalledOnce();
  expect(native.animation.play).not.toHaveBeenCalled();
  await expect(handle.finished).resolves.toEqual({ status: "cancelled" });
});

it("cancels the previous handle prepared for the same root", async () => {
  const first = nativeAnimation();
  const second = nativeAnimation();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.append(shard());
  vi.mocked(Element.prototype.animate)
    .mockReturnValueOnce(first.animation)
    .mockReturnValueOnce(second.animation);

  const previous = prepareShardAnimation(svg, { type: "scatter" });
  const current = prepareShardAnimation(svg, { type: "settle" });

  await expect(previous.finished).resolves.toEqual({
    status: "cancelled",
  });
  expect(first.animation.cancel).toHaveBeenCalledOnce();
  current.cancel();
});

it.each([
  ["empty", () => document.createElementNS("http://www.w3.org/2000/svg", "svg")],
  [
    "reduced-motion",
    () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
      } as MediaQueryList);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.append(shard());
      return svg;
    },
  ],
  [
    "unsupported",
    () => {
      Element.prototype.animate =
        undefined as unknown as typeof Element.prototype.animate;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.append(shard());
      return svg;
    },
  ],
] as const)("reports skipped/%s", async (reason, createRoot) => {
  const handle = prepareShardAnimation(createRoot(), { type: "settle" });
  await expect(handle.finished).resolves.toEqual({
    status: "skipped",
    reason,
  });
});

it.each([
  [{ type: "settle", speed: 0 }, "speed"],
  [{ type: "settle", speed: Number.NaN }, "speed"],
  [{ type: "settle", distance: -1 }, "distance"],
] as const)("rejects invalid options before mutation", (options, field) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.append(shard());
  expect(() => prepareShardAnimation(svg, options)).toThrow(field);
  expect(Element.prototype.animate).not.toHaveBeenCalled();
});

it("rolls back every shard after a preparation failure", async () => {
  const first = nativeAnimation();
  const cause = new Error("animate failed");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.append(shard(), shard());
  vi.mocked(Element.prototype.animate)
    .mockReturnValueOnce(first.animation)
    .mockImplementationOnce(() => {
      throw cause;
    });

  const handle = prepareShardAnimation(svg, { type: "scatter" });

  expect(first.animation.cancel).toHaveBeenCalledOnce();
  const result = await handle.finished;
  expect(result.status).toBe("failed");
  if (result.status === "failed") {
    expect(result.error).toBeInstanceOf(ShardAnimationError);
    expect(result.error.phase).toBe("prepare");
    expect(result.error.cause).toBe(cause);
  }
});

it("fails atomically when native playback rejects", async () => {
  const first = nativeAnimation();
  const second = nativeAnimation();
  const cause = new Error("play failed");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.append(shard(), shard());
  vi.mocked(Element.prototype.animate)
    .mockReturnValueOnce(first.animation)
    .mockReturnValueOnce(second.animation);

  const handle = prepareShardAnimation(svg, { type: "scatter" });
  handle.play();
  first.completion.reject(cause);

  const result = await handle.finished;
  expect(result.status).toBe("failed");
  expect(second.animation.cancel).toHaveBeenCalledOnce();
  if (result.status === "failed") {
    expect(result.error.phase).toBe("play");
    expect(result.error.cause).toBe(cause);
  }
});
```

Also retain public-behavior tests for visual X stagger ordering and for placing
motion outside the base glyph scale. Assert through calls to
`Element.prototype.animate`; do not re-export planning helpers for these tests.

- [ ] **Step 5: Implement the public types, validation, and terminal handle helper**

Replace the old public option/helper types with the Interfaces above. Add an
internal deferred-result helper and an error class:

```ts
export class ShardAnimationError extends Error {
  readonly phase: "prepare" | "play";
  override readonly cause: unknown;

  constructor(phase: "prepare" | "play", cause: unknown) {
    super(`Shard animation failed during ${phase}`, { cause });
    this.name = "ShardAnimationError";
    this.phase = phase;
    this.cause = cause;
  }
}

function validateOptions(options: ShardAnimationOptions): void {
  if (
    options.speed !== undefined &&
    (!Number.isFinite(options.speed) || options.speed <= 0)
  ) {
    throw new RangeError("speed must be finite and greater than zero");
  }
  if (
    options.distance !== undefined &&
    (!Number.isFinite(options.distance) || options.distance < 0)
  ) {
    throw new RangeError("distance must be finite and non-negative");
  }
}

function resolvedHandle(
  result: ShardAnimationResult,
): ShardAnimationHandle {
  return {
    play() {},
    cancel() {},
    finished: Promise.resolve(result),
  };
}
```

Keep `buildShardKeyframes()` and `planShardTimings()` as unexported functions.
Remove `direction` and delete the old tolerant `normalizedSpeed()` behavior;
validation now rejects invalid provided values.

- [ ] **Step 6: Implement synchronous atomic preparation**

Implement `prepareShardAnimation()` with a private root registry:

```ts
const activeHandles = new WeakMap<ParentNode, ShardAnimationHandle>();

export function prepareShardAnimation(
  root: ParentNode,
  options: ShardAnimationOptions,
): ShardAnimationHandle {
  validateOptions(options);
  activeHandles.get(root)?.cancel();

  const shards = Array.from(
    root.querySelectorAll<SVGGElement>("[data-shard-motion]"),
  );
  if (shards.length === 0) {
    return resolvedHandle({ status: "skipped", reason: "empty" });
  }

  const rootNode = root as Node;
  const ownerDocument =
    rootNode.nodeType === 9
      ? (root as Document)
      : rootNode.ownerDocument;
  const ownerWindow = ownerDocument?.defaultView;
  if (
    ownerWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return resolvedHandle({
      status: "skipped",
      reason: "reduced-motion",
    });
  }
  if (shards.some((item) => typeof item.animate !== "function")) {
    return resolvedHandle({ status: "skipped", reason: "unsupported" });
  }

  const timings = planShardTimings({
    type: options.type,
    speed: options.speed,
    stagger: options.stagger,
    shardXs: shards.map(
      (item) =>
        visualShardX(item) ??
        finiteDatasetNumberOrUndefined(item.dataset.shardX),
    ),
  });
  const animations: Animation[] = [];

  try {
    shards.forEach((item, index) => {
      const animation = item.animate(
        buildShardKeyframes({
          type: options.type,
          directionX: finiteDatasetNumber(item.dataset.directionX),
          directionY: finiteDatasetNumber(item.dataset.directionY),
          distance: options.distance ?? 100,
          scale: options.type === "settle" ? 1.05 : 0.95,
        }),
        {
          ...timings[index],
          fill: "both",
        },
      );
      animation.pause();
      animation.currentTime = 0;
      animations.push(animation);
    });

    const handle = createPreparedHandle(root, animations, options.type);
    activeHandles.set(root, handle);
    return handle;
  } catch (cause) {
    animations.forEach((animation) => animation.cancel());
    return resolvedHandle({
      status: "failed",
      error: new ShardAnimationError("prepare", cause),
    });
  }
}
```

Implement `createPreparedHandle()` as this closure-owned state machine:

```ts
function createPreparedHandle(
  root: ParentNode,
  animations: Animation[],
  type: ShardAnimationOptions["type"],
): ShardAnimationHandle {
  type State =
    | "prepared"
    | "running"
    | "completed"
    | "cancelled"
    | "failed";

  let state: State = "prepared";
  let released = false;
  let resolveFinished!: (result: ShardAnimationResult) => void;
  const finished = new Promise<ShardAnimationResult>((resolve) => {
    resolveFinished = resolve;
  });
  const nativeCompletion = Promise.all(
    animations.map((animation) => animation.finished),
  ).then(
    () => ({ ok: true as const }),
    (cause: unknown) => ({ ok: false as const, cause }),
  );

  const release = () => {
    if (released) return;
    released = true;
    animations.forEach((animation) => animation.cancel());
  };
  const detach = () => {
    if (activeHandles.get(root) === handle) {
      activeHandles.delete(root);
    }
  };
  const fail = (cause: unknown) => {
    if (state !== "running") return;
    state = "failed";
    release();
    detach();
    resolveFinished({
      status: "failed",
      error: new ShardAnimationError("play", cause),
    });
  };

  const handle: ShardAnimationHandle = {
    play() {
      if (state !== "prepared") return;
      state = "running";

      void nativeCompletion.then((outcome) => {
        if (state !== "running") return;
        if (!outcome.ok) {
          fail(outcome.cause);
          return;
        }

        state = "completed";
        if (type === "settle") {
          release();
          detach();
        }
        resolveFinished({ status: "completed" });
      });

      try {
        animations.forEach((animation) => animation.play());
      } catch (cause) {
        fail(cause);
      }
    },

    cancel() {
      if (state === "completed") {
        release();
        detach();
        return;
      }
      if (state === "cancelled" || state === "failed") return;

      state = "cancelled";
      release();
      detach();
      resolveFinished({ status: "cancelled" });
    },

    finished,
  };

  return handle;
}
```

`nativeCompletion` converts native rejection to data as soon as the handle is
created. This prevents an unhandled `AbortError` when a prepared animation is
cancelled before `play()`. A completed scatter retains its fill effect until
`cancel()` or same-root replacement releases it; a completed settle releases
its effect immediately because the base SVG is already assembled.

- [ ] **Step 7: Run core tests and type checking**

Run:

```bash
pnpm --filter @yuragi-labs/core test
pnpm --filter @yuragi-labs/core typecheck
```

Expected: both commands exit 0; the core animation suite covers preparation,
play, cancellation, each skip reason, validation, preparation rollback,
playback failure, existing keyframes, stagger, and glyph wrapper placement.

- [ ] **Step 8: Commit the core Module**

```bash
git add packages/core/src/animation.ts packages/core/test/animation.test.ts
git commit -m "feat(core): add controllable shard animation handle"
```

---

### Task 2: Migrate the React Adapter to handles

**Files:**

- Modify: `packages/react/src/animation-options.ts`
- Modify: `packages/react/src/ShardedSvg.tsx`
- Modify: `packages/react/src/exit-overlay.ts`
- Modify: `packages/react/test/YuragiText.test.tsx`
- Modify: `packages/react/test/runtime-transition.test.tsx`

**Interfaces:**

- Consumes: `prepareShardAnimation()`, `ShardAnimationHandle`,
  `ShardAnimationOptions`, and `ShardAnimationResult` from Task 1.
- Produces: React settle and exit-overlay behavior using the new handle;
  no additional public API.

- [ ] **Step 1: Add a reusable mocked handle to React tests**

Replace the `animateShards` mock with a `prepareShardAnimation` mock and helper:

```ts
import {
  type ShardAnimationHandle,
  type ShardAnimationResult,
  type TextOutline,
} from "@yuragi-labs/core";

const coreMocks = vi.hoisted(() => ({
  prepareShardAnimation: vi.fn(),
}));

function animationHandle(
  finished:
    | Promise<ShardAnimationResult>
    | ShardAnimationResult = { status: "completed" },
): ShardAnimationHandle {
  return {
    play: vi.fn(),
    cancel: vi.fn(),
    finished: Promise.resolve(finished),
  };
}

vi.mock("@yuragi-labs/core", async () => {
  const actual = await vi.importActual<typeof import("@yuragi-labs/core")>(
    "@yuragi-labs/core",
  );
  return {
    ...actual,
    prepareShardAnimation: coreMocks.prepareShardAnimation,
  };
});

beforeEach(() => {
  coreMocks.prepareShardAnimation.mockReset();
  coreMocks.prepareShardAnimation.mockImplementation(() =>
    animationHandle(),
  );
});
```

Update assertions to inspect `coreMocks.prepareShardAnimation.mock.calls`. For delayed
completion tests, pass
`settleFinished.promise.then(() => ({ status: "completed" as const }))` to the
helper and assert `handle.play` was called.

- [ ] **Step 2: Add failing React tests for prepare-before-mount and cleanup**

Use a mock implementation that records whether the SVG is connected during
preparation:

```ts
it("prepares settle before mounting the SVG and cancels stale handles", () => {
  const first = animationHandle();
  const second = animationHandle();
  const connectedDuringPrepare: boolean[] = [];
  coreMocks.prepareShardAnimation
    .mockImplementationOnce((root) => {
      connectedDuringPrepare.push((root as SVGSVGElement).isConnected);
      return first;
    })
    .mockImplementationOnce((root) => {
      connectedDuringPrepare.push((root as SVGSVGElement).isConnected);
      return second;
    });

  const { rerender } = render(
    <YuragiText text="A" outline={outline} animation={{ exit: false }} />,
  );
  rerender(
    <YuragiText
      text="B"
      outline={nextOutline}
      animation={{ exit: false }}
    />,
  );

  expect(connectedDuringPrepare).toEqual([false, false]);
  expect(first.play).toHaveBeenCalledOnce();
  expect(first.cancel).toHaveBeenCalledOnce();
  expect(second.play).toHaveBeenCalledOnce();
});
```

Add result-policy assertions: `completed` and `skipped` invoke completion
callbacks; `cancelled` and `failed` do not.

- [ ] **Step 3: Run the React tests and verify that old imports fail**

Run:

```bash
pnpm --filter @yuragi-labs/react test
```

Expected: FAIL because the React Implementation still imports and invokes
`animateShards`.

- [ ] **Step 4: Update option helpers and settle lifecycle**

Change `animation-options.ts` to return `ShardAnimationOptions`. In
`ShardedSvg.tsx`:

```ts
const settleAnimationRef = useRef<ShardAnimationHandle | null>(null);
```

Before `host.replaceChildren(svg)`, cancel the old settle handle, prepare the new
one when enter animation is enabled, and store it:

```ts
settleAnimationRef.current?.cancel();
const settleAnimation = props.animation.enter
  ? prepareShardAnimation(
      svg,
      createSettleAnimationOptions(props.animation.speed),
    )
  : null;
settleAnimationRef.current = settleAnimation;

host.replaceChildren(svg);
settleAnimation?.play();
if (settleAnimation) {
  void settleAnimation.finished.then((result) => {
    const isCurrent =
      mountedRef.current &&
      renderedSvgRef.current?.svg === svg &&
      settleAnimationRef.current === settleAnimation;
    if (
      isCurrent &&
      (result.status === "completed" || result.status === "skipped")
    ) {
      notifyEnterComplete();
    }
  });
}
```

The component unmount cleanup must cancel
`settleAnimationRef.current` and clear the ref.

- [ ] **Step 5: Update the exit-overlay lifecycle**

Change `animateSvgExit()` to return `Promise<ShardAnimationResult>`:

```ts
const animation = prepareShardAnimation(
  animatedSvg,
  createScatterAnimationOptions(options.speed),
);
animation.play();

return animation.finished.finally(() => {
  overlay?.remove();
});
```

Where `ShardedSvg` awaits an exit, invoke `notifyExitComplete()` only when the
result is `completed` or `skipped`. Preserve the existing microtask scheduling
that prevents StrictMode's synthetic unmount from creating a scatter overlay.

- [ ] **Step 6: Run React tests and type checking**

Run:

```bash
pnpm --filter @yuragi-labs/react test
pnpm --filter @yuragi-labs/react typecheck
```

Expected: both commands exit 0; StrictMode, Suspense callback freshness,
text-change overlays, unmount overlays, disabled phases, and handle cleanup
remain covered.

- [ ] **Step 7: Commit the React Adapter**

```bash
git add packages/react/src packages/react/test
git commit -m "refactor(react): use shard animation handles"
```

---

### Task 3: Migrate the playground and document the public Interface

**Files:**

- Modify: `apps/playground/src/shard-inspector/ShardPreview.tsx`
- Modify: `packages/core/README.md`
- Modify: `packages/core/CHANGELOG.md`

**Interfaces:**

- Consumes: `prepareShardAnimation()` and `ShardAnimationHandle` from Task 1.
- Produces: a documented public usage example and playground cleanup.

- [ ] **Step 1: Migrate playground playback with effect cleanup**

Replace the playback effect with:

```ts
useLayoutEffect(() => {
  const svg = svgRef.current;
  if (!svg || !playback) return;

  const animation = prepareShardAnimation(svg, {
    type: playback.type,
    stagger: "by-x",
    distance: playback.distance,
  });
  animation.play();

  return () => {
    animation.cancel();
  };
}, [playback]);
```

Replace the import of `animateShards` with `prepareShardAnimation`.

- [ ] **Step 2: Document direct core usage**

Add an Animation section to `packages/core/README.md` containing:

```ts
import {
  createShardedSvg,
  layoutShardedText,
  prepareShardAnimation,
} from "@yuragi-labs/core";

const svg = createShardedSvg(layoutShardedText(outline, { size: 72 }));
const animation = prepareShardAnimation(svg, {
  type: "settle",
  stagger: "by-x",
});

host.replaceChildren(svg);
animation.play();

const result = await animation.finished;
if (result.status === "failed") {
  console.error(result.error);
}
```

Document all four statuses and three skip reasons. State that preparation
captures the current shards and synchronously applies the initial frame, and
that callers must cancel handles they abandon.

- [ ] **Step 3: Record the breaking API replacement**

Add a top entry to `packages/core/CHANGELOG.md`:

```md
### Add controllable shard animation handles

Replace `animateShards()` with `prepareShardAnimation()`. The returned handle
separates synchronous initial-frame preparation from `play()`, supports
`cancel()`, and exposes a non-rejecting `finished` Promise with explicit
completed, cancelled, skipped, and failed results.
```

- [ ] **Step 4: Run workspace verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all commands exit 0 and generated declarations expose
`prepareShardAnimation`, `ShardAnimationHandle`, `ShardAnimationResult`, and
`ShardAnimationError`, with no `animateShards` export.

- [ ] **Step 5: Search for stale public API references**

Run:

```bash
rg -n \
  "animateShards|AnimateShardsOptions|direction.*outline-vector" \
  --glob '!**/dist/**' \
  --glob '!**/node_modules/**' \
  packages/*/src packages/*/test apps/*/src examples/*/src \
  README.md packages/*/README.md

rg -n \
  "export .*buildShardKeyframes|export .*planShardTimings" \
  packages/*/src
```

Expected: neither command finds a match. The private `buildShardKeyframes()` and
`planShardTimings()` helpers remain intentionally unexported. Historical mentions
in changelogs and this design/implementation plan are intentional.

- [ ] **Step 6: Commit playground and documentation**

```bash
git add apps/playground/src/shard-inspector/ShardPreview.tsx \
  packages/core/README.md packages/core/CHANGELOG.md
git commit -m "docs(core): document animation handle lifecycle"
```

The blog migration is intentionally a separate follow-up plan in the
`lawvs.github.io` repository. Its exact files are
`src/components/YuragiTitle.svelte`, `src/utils/yuragi-animation.ts`, and
`test/yuragi-animation.test.mjs`; it must keep
`createAnimationBudget()` and `waitForOpaqueTransition()` while replacing only
`createInitialAnimationController()` with the core handle.
