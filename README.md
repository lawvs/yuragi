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
| `@yuragi/react` | Recommended React Canary runtime API and static renderer subpath. |
| `@yuragi/core` | Shared outline types, layout helpers, SVG helpers, and CSS. |
| `@yuragi/compiler` | Low-level native build-time outline compiler. |
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
    >
      <YuragiText
        text="Dashboard"
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

## Examples

Run either Vite + React example after building the workspace packages:

```bash
pnpm install
pnpm build
pnpm --filter @yuragi/example-react-runtime-vite dev
pnpm --filter @yuragi/example-react-static-vite dev
```

- [`examples/react-runtime-vite`](examples/react-runtime-vite) demonstrates
  the recommended runtime WASM API with dynamic text.
- [`examples/react-static-vite`](examples/react-static-vite) demonstrates an
  explicit compiler script, committed outlines, and `@yuragi/react/static`.

## Static Precompile Escape Hatch

Use static precompiled outlines when an app needs lower runtime cost,
deterministic generated assets, or stricter resource control.

Install the build-time compiler:

```bash
pnpm add -D @yuragi/compiler
```

Compile a known title list in your own build script and write the resulting
outline map wherever your application keeps generated assets:

```js
// scripts/build-yuragi.mjs
import { writeFile } from "node:fs/promises";
import { compileOutlines } from "@yuragi/compiler";

const bundle = await compileOutlines({
  font: "./fonts/title.otf",
  axes: { wght: 900 },
  titles: ["Dashboard", "Settings"],
});

await writeFile(
  "./src/yuragi-outlines.json",
  JSON.stringify(bundle.outlines),
);
```

Render an explicit outline with the static React entry:

```tsx
import { YuragiStyles, YuragiText } from "@yuragi/react/static";
import outlines from "./yuragi-outlines.json";

export function Title() {
  return (
    <>
      <YuragiStyles />
      <YuragiText
        text="Dashboard"
        outline={outlines["Dashboard"]}
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
- [`@yuragi/core`](packages/core/README.md)
- [`@yuragi/compiler`](packages/compiler/README.md)
- [`@yuragi/wasm`](packages/wasm/README.md)

## Requirements

- React Canary for `@yuragi/react`.
- A font file that can be loaded by the runtime or static compiler.
- Rust and Cargo on `PATH` when using the static build-time compiler wrapper.

## Playground

The playground uses the same title font as Layered:
`SourceHanSerifSC-VF.otf` at `wght: 900`. The font is downloaded on first
local dev run to Vite's cache under `apps/playground/node_modules/.vite/yuragi`
and is not committed to this repository.

To use a local font file instead:

```bash
YURAGI_FONT="/path/to/title-font.otf" pnpm dev
```

`YURAGI_FONT` can also be an `http:` or `https:` URL; remote fonts are
downloaded to the same Vite cache and served by the local dev server.

Run the playground locally:

```bash
pnpm dev
```
