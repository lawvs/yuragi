# @yuragi-labs/core

Shared outline types, DOM rendering, animation lifecycle control, CSS, and the
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

## Static SVG Path

Use `outlineToSvgPath` when another renderer needs portable SVG geometry
without Yuragi's DOM structure, styles, or animation lifecycle:

```ts
import { outlineToSvgPath } from "@yuragi-labs/core";

const outline = font.compile("Yuragi");
const path = outlineToSvgPath(outline, { size: 72 });

svg.setAttribute("viewBox", path.viewBox.join(" "));
svgPath.setAttribute("d", path.d);
```

The function applies Yuragi's wrapping and alignment layout, flattens glyph
positions and font scaling into one `d` string, and returns its view box. It is
DOM-free; presentation such as fill, stroke, and animation belongs to the
consumer.

## DOM Rendering

Use `renderYuragiText` when integrating Yuragi without the React package:

```ts
import { renderYuragiText } from "@yuragi-labs/core";

const title = renderYuragiText(host, outline, {
  size: 72,
  maxWidth: 900,
});

const result = await title.play();
if (result.status === "failed") {
  console.error(result.error);
}
```

The renderer lays out the outline, creates its SVG in the target's document,
prepares the initial settle frame before changing the target, mounts it, and
autoplays by default. Set `animation: false` for a static SVG.

For a page-transition gate, prepare and mount first, then start playback:

```ts
const title = renderYuragiText(host, outline, {
  size: 72,
  animation: { autoplay: false },
});

await transitionReady;
const result = await title.play();
```

The handle exposes its `element` and four lifecycle methods:

- `play()` starts or joins the prepared enter animation and returns its
  non-rejecting result promise. Repeated calls return the same promise.
- `cancel()` stops the active enter or exit animation.
- `remove(options?)` removes the title and scatters a fixed-position clone.
- `dispose()` synchronously cancels and removes resources owned by the handle.

Both `play()` and `remove()` resolve with
`completed`, `cancelled`, `skipped`, or `failed`. A skipped result reports
`disabled`, `empty`, `reduced-motion`, or `unsupported`; a failed result
contains a `YuragiTextError` whose phase is `enter` or `exit`.

When provided, `speed` must be finite and greater than zero, and `distance`
must be finite and non-negative. Rendering another title into the same target
automatically cancels the previous owner without allowing a stale handle to
alter the replacement.

By default, the SVG's accessible label is reconstructed from the outline.
Pass `ariaLabel: "..."` to override it or `ariaLabel: false` when a separate
accessible text node already labels the title.

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

const outline = font.compile("Dashboard");
font.dispose();
```

`createYuragiFont` loads the WASM compiler, loads the font, and returns a
`YuragiFont` object with:

- `info`: font metadata reported by the runtime.
- `compile(text, options?)`: synchronously compile one string into a cached
  `TextOutline`.
- `preload(texts?)`: synchronously compile and cache a group of strings.
- `dispose()`: release the runtime reference and clear the in-memory cache.

Asset loading is asynchronous; compilation is synchronous after
`createYuragiFont()` resolves.

For advanced control, instantiate the runtime directly:

```ts
import { YuragiWasmRuntime } from "@yuragi-labs/core/wasm";

const runtime = await YuragiWasmRuntime.load(wasmBytes);
const info = runtime.setFont(fontBytes);
const outline = runtime.compileTitle("Dashboard", { wght: 900 });
```
