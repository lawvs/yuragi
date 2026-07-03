# yuragi

`yuragi` renders text as SVG glyph fragments and animates those fragments
with hover outline, settle, and scatter effects.

> Credits: Yuragi's original interaction study is inspired by the title
> animation in [Layered](https://github.com/CircuitCoder/layered), including
> the hollow hover treatment and scattered title transition. Special thanks to
> [喵喵](https://github.com/CircuitCoder) for the source of that visual idea.

## Why "yuragi"?

Yuragi is named after the Japanese word `揺らぎ`, meaning gentle swaying,
fluctuation, or flicker. It keeps the candle-flame feeling behind `摇曳`,
without using pinyin, and it also describes how this library works: title
strokes are split into shards and animated with small variations that feel
alive rather than mechanical.

## Packages

| Package | Purpose |
| --- | --- |
| `@yuragi/react` | React Canary components for static and runtime sharded text. |
| `@yuragi/core` | Shared outline types, layout helpers, SVG helpers, and CSS. |
| `@yuragi/unplugin` | Vite/Rollup/Webpack/esbuild/Rspack build-time outline plugin. |
| `@yuragi/compiler` | Native Rust-backed build-time outline compiler wrapper. |
| `@yuragi/wasm` | Experimental runtime WASM compiler for dynamic text. |

## Install

```bash
pnpm add @yuragi/react @yuragi/core
pnpm add -D @yuragi/unplugin @yuragi/compiler
```

Add `@yuragi/wasm` when you need runtime compilation for text that is not
known at build time.

## Quick Start

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
import { YuragiText } from "@yuragi/react";
import outlines from "virtual:yuragi/outlines";
import "@yuragi/core/style.css";

export function Title() {
  return (
    <YuragiText
      text="Dashboard"
      outline={outlines["Dashboard"]}
      sharedId="title:dashboard"
      size={56}
      hover="outline"
      transition={{ enter: "settle", exit: "scatter", speed: 1 }}
    />
  );
}
```

For package-specific options and lower-level APIs, see the package READMEs:

- [`@yuragi/react`](packages/react/README.md)
- [`@yuragi/unplugin`](packages/unplugin/README.md)
- [`@yuragi/core`](packages/core/README.md)
- [`@yuragi/compiler`](packages/compiler/README.md)
- [`@yuragi/wasm`](packages/wasm/README.md)

## Requirements

- React Canary for `@yuragi/react`.
- Browser support for the View Transition API when using shared element motion.
- Rust and Cargo on `PATH` when using the build-time compiler wrapper.
- A font file that can be loaded by the compiler.

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
