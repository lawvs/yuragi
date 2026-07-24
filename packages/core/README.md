# @yuragi-labs/core

Shared types, layout helpers, SVG helpers, animation helpers, CSS, and the
lower-level runtime WASM compiler for Yuragi packages.

Most applications use this package indirectly through `@yuragi-labs/react`. Static
React users usually render `YuragiStyles` from `@yuragi-labs/react/static`; import
the CSS file directly only when you want to manage Yuragi styles through your
app or bundler:

```tsx
import "@yuragi-labs/core/style.css";
```

## Important Types

```ts
import type {
  OutlineMap,
  TextOutline,
  TextOutlineBundle,
} from "@yuragi-labs/core";
```

- `TextOutlineBundle`: compiled font metadata plus an outline map.
- `OutlineMap`: title string to outline mapping.
- `TextOutline`: glyph shard geometry for one rendered string.

## Animation

Use `prepareShardAnimation` when integrating Yuragi's shard animations without
the React package:

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

Preparation captures the current shards and synchronously applies the initial
frame. The handle's non-rejecting `finished` Promise resolves with one of four
statuses:

- `completed`: every shard animation finished.
- `cancelled`: `cancel()` stopped the animation.
- `skipped`: playback was unnecessary or unavailable. Its reason is `empty`
  when no shards were captured, `reduced-motion` when the user's motion
  preference disables animation, or `unsupported` when the Web Animations API
  is unavailable.
- `failed`: preparation or playback failed; the result includes a
  `ShardAnimationError`.

Callers must call `cancel()` on handles they abandon, such as when removing or
replacing the animated SVG.

## CSS Export

The package exports:

```ts
import "@yuragi-labs/core/style.css";
```

The stylesheet defines the classes used by the React renderer and should be
included exactly once in the application.

`@yuragi-labs/core` also exports `YURAGI_STYLE_TEXT` for renderers that need to
declare the stylesheet in another environment, such as `@yuragi-labs/react`'s
static `YuragiStyles` component. Most React users should import
`YuragiStyles` from `@yuragi-labs/react/static` instead of using this value directly.

## Runtime WASM Compiler

React applications should prefer `YuragiFontProvider` and `YuragiText` from
`@yuragi-labs/react`. Use `@yuragi-labs/core/wasm` directly for custom runtime
integrations:

```ts
import { createYuragiFont, type FontAxes } from "@yuragi-labs/core/wasm";

const axes = { wght: 900 } satisfies FontAxes;

const font = await createYuragiFont({
  font: "/fonts/NotoSerifSC[wght].ttf",
  axes,
  preload: ["Dashboard"],
});

const outline = await font.compile("Dashboard");
font.dispose();
```

`createYuragiFont` loads the WASM compiler, loads the font, and returns a
`YuragiFont` object with:

- `info`: font metadata reported by the runtime.
- `compile(text, options?)`: compile one string into a `TextOutline`.
- `preload(texts?)`: compile and cache a group of strings.
- `dispose()`: release the runtime reference and clear the in-memory cache.

For advanced control, instantiate the runtime directly:

```ts
import { YuragiWasmRuntime } from "@yuragi-labs/core/wasm/runtime";

const runtime = await YuragiWasmRuntime.load(wasmBytes);
const info = runtime.setFont(fontBytes);
const outline = runtime.compileTitle("Dashboard", { wght: 900 });
```
