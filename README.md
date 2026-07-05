# yuragi

`yuragi` renders text as SVG glyph fragments and animates those fragments
with hover outline, settle, and scatter effects.

The name comes from Japanese `揺らぎ`, a gentle swaying or flicker that echoes
`摇曳` and the subtle variation of the shard animation.

> Credits: Yuragi's original interaction study is inspired by the title
> animation in [Layered](https://github.com/CircuitCoder/layered), including
> the hollow hover treatment and scattered title transition. Special thanks to
> [喵喵](https://github.com/CircuitCoder) for the source of that visual idea.

## Packages

| Package | Purpose |
| --- | --- |
| `@yuragi/react` | React Canary runtime text components and static escape hatch. |
| `@yuragi/core` | Shared outline types, layout helpers, SVG helpers, and CSS. |
| `@yuragi/unplugin` | Vite/Rollup/Webpack/esbuild/Rspack build-time outline plugin. |
| `@yuragi/compiler` | Native Rust-backed build-time outline compiler wrapper. |
| `@yuragi/wasm` | Lower-level runtime WASM compiler used by the React provider. |

## Install

```bash
pnpm add @yuragi/react
```

## Quick Start

Use the runtime React entry when titles are dynamic or you want the simplest
setup:

```tsx
import { YuragiFontProvider, YuragiText } from "@yuragi/react";

export function Title() {
  return (
    <YuragiFontProvider
      font="/fonts/NotoSerifSC[wght].ttf"
      axes={{ wght: 900 }}
      preload={["Dashboard"]}
    >
      <YuragiText
        text="Dashboard"
        sharedId="title:dashboard"
        size={56}
        hover="outline"
        transition={{ enter: "settle", exit: "scatter", speed: 1 }}
      />
    </YuragiFontProvider>
  );
}
```

`YuragiFontProvider` loads the font and runtime compiler, caches compiled
outlines in memory, and renders fallback text until the outline is ready. It
also includes Yuragi's required styles by default.

## Static Precompile Escape Hatch

Use static precompiled outlines when an app needs lower runtime cost,
deterministic generated assets, or stricter resource control.

Install the build-time compiler and plugin:

```bash
pnpm add -D @yuragi/unplugin @yuragi/compiler
```

Configure the build-time plugin with a font and the titles you want to shard:

```ts
import Yuragi from "@yuragi/unplugin/vite";

export default {
  plugins: [
    Yuragi({
      font: "./fonts/title.otf",
      axes: { wght: 900 },
      titles: ["Dashboard", "Settings"],
    }),
  ],
};
```

Add the virtual module types to your Vite env file:

```ts
/// <reference types="@yuragi/unplugin/client" />
```

Render a title with React Canary:

```tsx
import { YuragiStyles, YuragiText } from "@yuragi/react/static";
import outlines from "virtual:yuragi/outlines";

export function Title() {
  return (
    <>
      <YuragiStyles />
      <YuragiText
        text="Dashboard"
        outline={outlines["Dashboard"]}
        sharedId="title:dashboard"
        size={56}
        hover="outline"
        transition={{ enter: "settle", exit: "scatter", speed: 1 }}
      />
    </>
  );
}
```

`YuragiStyles` renders the small stylesheet Yuragi needs for hover and
reduced-motion behavior. If your app already imports `@yuragi/core/style.css`,
you do not need to render `YuragiStyles`.

For package-specific options and lower-level APIs, see the package READMEs:

- [`@yuragi/react`](packages/react/README.md)
- [`@yuragi/unplugin`](packages/unplugin/README.md)
- [`@yuragi/core`](packages/core/README.md)
- [`@yuragi/compiler`](packages/compiler/README.md)
- [`@yuragi/wasm`](packages/wasm/README.md)

## Requirements

- React Canary for `@yuragi/react`.
- Browser support for the View Transition API when using shared element motion.
- A font file that can be loaded by the compiler.
- Rust and Cargo on `PATH` when using the static build-time compiler wrapper.

## Playground

The playground uses the same title font as Layered:
`SourceHanSerifSC-VF.otf` at `wght: 900`. The font is downloaded on first
build to Vite's cache under `apps/playground/node_modules/.vite/yuragi`
and is not committed to this repository.

To use a local font file instead:

```bash
YURAGI_FONT="/path/to/title-font.otf" pnpm playground:build
```

`YURAGI_FONT` can also be an `http:` or `https:` URL; remote fonts are
downloaded to the same Vite cache before outline compilation.

Run the playground locally:

```bash
pnpm dev
```
