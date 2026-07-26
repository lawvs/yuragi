# @yuragi-labs/react

React 19 components for rendering Yuragi text. The recommended entry uses
the runtime WASM compiler so text can be compiled on demand without a build-time
title list. Precompiled static outlines remain available as an escape hatch.

## Runtime WASM Entry

Import from `@yuragi-labs/react` for the default runtime path:

```tsx
import { YuragiFontProvider, YuragiText } from "@yuragi-labs/react";

export function RuntimeTitle({ title }: { title: string }) {
  return (
    <YuragiFontProvider
      font="/fonts/NotoSerifSC[wght].ttf"
      axes={{ wght: 900 }}
    >
      <YuragiText
        text={title}
        size={88}
        fallback="text"
        hover="outline"
      />
    </YuragiFontProvider>
  );
}
```

`YuragiFontProvider` owns the shared font compiler, caches compiled outlines in
memory, and renders fallback text while the compiler and font are loading.
Once the font is ready, `YuragiText` compiles its outline synchronously in the
same render. The provider includes Yuragi's required styles by default.

Pass `includeStyles={false}` if your app imports `@yuragi-labs/core/style.css`
manually, and pass `styleNonce` when your CSP requires a style nonce.

## Font Axes

`axes` accepts `FontAxes`, which includes common OpenType variation axis tags
such as `wght`, `wdth`, `opsz`, `slnt`, and `ital`, while still allowing custom
4-character tags from specific fonts:

```tsx
import type { FontAxes } from "@yuragi-labs/react";

const axes = {
  wght: 900,
  opsz: 18,
  XOPQ: 120,
  TEST: 1,
} satisfies FontAxes;
```

## Font State

Use `useYuragiFont()` inside `YuragiFontProvider` when UI needs to know whether
the runtime compiler and font are ready:

```tsx
import { useYuragiFont } from "@yuragi-labs/react";

function PlayButton() {
  const font = useYuragiFont();

  return (
    <button disabled={!font.ready}>
      {font.status === "ready" ? "Play" : "Loading font"}
    </button>
  );
}
```

`font.status` is `"loading"`, `"ready"`, or `"error"`. This describes provider
readiness only; individual `YuragiText` outlines compile synchronously on
demand after the provider is ready.

## Runnable Example

See [`examples/react-runtime-vite`](../../examples/react-runtime-vite) for a
minimal Vite + React example using the runtime provider with dynamic text.

## Preloading Titles

`preload` is optional. `YuragiText` compiles text synchronously on demand after
the font is ready.

Use `preload` only when you already know specific titles that should be compiled
as soon as the provider is ready:

```tsx
<YuragiFontProvider
  font="/fonts/NotoSerifSC[wght].ttf"
  axes={{ wght: 900 }}
  preload={["Dashboard", "Settings"]}
>
  <YuragiText text="Dashboard" />
</YuragiFontProvider>
```

This warms Yuragi's in-memory outline cache. It does not preload the font file
itself; use browser preload links or your framework's asset loading tools for
that. Preloading moves known-title compilation into the provider's loading
phase, so the ready render can reuse the cached outline. Use `"hidden"` to
reserve fallback text layout while the font loads, or a delayed fallback when
slow loading should eventually show readable text.

## Installed Local Fonts

Yuragi needs font bytes so the runtime compiler can read glyph outlines. CSS
local fonts such as `font-family` or `@font-face src: local(...)` can render
text in the browser, but they do not expose the underlying font bytes to
JavaScript.

If your app wants to use installed fonts, load them with the browser's Local
Font Access API and pass the bytes to `YuragiFontProvider`:

```tsx
async function loadInstalledFont(postscriptName: string) {
  if (!("queryLocalFonts" in window)) {
    throw new Error("Local Font Access API is not supported");
  }

  const fonts = await window.queryLocalFonts({
    postscriptNames: [postscriptName],
  });
  const font = fonts[0];

  if (!font) {
    throw new Error(`Local font not found: ${postscriptName}`);
  }

  return await (await font.blob()).arrayBuffer();
}

<YuragiFontProvider
  font={() => loadInstalledFont("SourceHanSerifSC-Bold")}
  axes={{ wght: 900 }}
>
  <YuragiText text="Dashboard" />
</YuragiFontProvider>;
```

This requires a secure context and user permission, and browser support is
limited. For most production apps, a URL font from `/public` or a CDN is more
reliable.

## Runtime Props

Import the runtime component props as `YuragiTextProps` from `@yuragi-labs/react`.

Settle and scatter animations are enabled by default. Disable all animation or
one phase explicitly when needed:

```tsx
<YuragiText text="Static title" animation={false} />
<YuragiText text="Enter only" animation={{ exit: false }} />
<YuragiText text="Exit only" animation={{ enter: false }} />
<YuragiText text="Delayed fallback" fallback={{ delayMs: 150 }} />
```

Runtime `YuragiText` skips settle when replacing its initial fallback with the
first compiled outline. Later text changes use the configured enter animation.

- `text`: rendered string.
- `size`: text size in CSS pixels.
- `maxWidth`: wrapping width.
- `align`: `"start"`, `"center"`, or `"end"`.
- `hover`: `"outline"` enables the hollow title hover treatment;
  `"none"` disables it.
- `fallback`: `"text"` renders readable text while the font is loading;
  `"hidden"` keeps the same fallback layout visually hidden; `"error"` throws.
  The runtime entry also accepts `{ delayMs }`, which keeps that hidden layout
  during the delay and then shows text if the outline is still unavailable. A
  zero delay is equivalent to `"text"`; the delay must be finite and
  non-negative.
- `animation`: enabled by default with settle on enter and scatter on exit;
  pass `false` to disable both animations.
- `animation.enter`: set to `false` to disable the settle animation.
- `animation.exit`: set to `false` to disable scatter when the title changes or
  unmounts.
- `animation.speed`: playback speed multiplier. It must be finite and greater
  than zero; zero, negative values, `NaN`, and infinities are invalid. `1` is
  the default, values below `1` are slower, and values above `1` are faster.
- `onEnterComplete`: called after the settle animation finishes.
- `onExitComplete`: called after the scatter animation finishes, including
  exits caused by text changes or unmounting.
- `className`, `style`: applied to the root element.

Exit scatter is rendered in a fixed viewport overlay so the old title keeps its
screen position while its shards animate out. Enter and exit are local shard
animations; Yuragi does not move text between separate page locations in v1.

## Static Precompiled Escape Hatch

Use `@yuragi-labs/react/static` when titles are known at build time and you want to
avoid the runtime compiler:

```tsx
import { YuragiStyles, YuragiText } from "@yuragi-labs/react/static";
import outlines from "./yuragi-outlines.json";

export function StaticTitle() {
  return (
    <>
      <YuragiStyles />
      <YuragiText
        text="Dashboard"
        outline={outlines["Dashboard"]}
        size={56}
        maxWidth={760}
        align="start"
        hover="outline"
        fallback="text"
      />
    </>
  );
}
```

Static `YuragiText` accepts the same visual and animation props as runtime
`YuragiText`, plus:

- `outline`: a compiled `TextOutline`, usually read from an outline map created
  by `@yuragi-labs/compiler`.

Its props type is exported as `StaticYuragiTextProps` from
`@yuragi-labs/react/static`.

The static entry does not discover titles or run a compiler. Call
`compileOutlines` from your own build script and pass the generated outline
explicitly. See [`@yuragi-labs/compiler`](../compiler/README.md) for the low-level
compiler API and [`examples/react-static-vite`](../../examples/react-static-vite)
for a runnable Vite example.

## `YuragiStyles`

`YuragiStyles` renders Yuragi's small stylesheet as a React `<style>` element.
Render it once near your app root when using the static entry.

```tsx
<YuragiStyles nonce={nonce} />
```

If your app imports `@yuragi-labs/core/style.css` directly, do not render
`YuragiStyles`.

## Requirements

- React 19.2 and React DOM 19.2.
- A font file that can be loaded by the runtime provider or the static compiler.
