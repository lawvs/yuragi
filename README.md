# yuragi

`yuragi` renders text as SVG glyph fragments and animates those fragments
with hover outline, settle, and scatter effects.

## Install

```bash
pnpm add @yuragi/react @yuragi/core
pnpm add -D @yuragi/unplugin @yuragi/compiler
```

## Configure the plugin

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

## Use React Canary

Add the virtual module types to your Vite env file:

```ts
/// <reference types="@yuragi/unplugin/client" />
```

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
      transition={{
        enter: "settle",
        exit: "scatter",
        speed: 1,
      }}
    />
  );
}
```

## React API

`YuragiText` is the v1 React entry point:

```tsx
<YuragiText
  text="Dashboard"
  outline={outlines["Dashboard"]}
  sharedId="title:dashboard"
  size={56}
  maxWidth={760}
  align="start"
  hover="outline"
  fallback="text"
  transition={{
    enter: "settle",
    exit: "scatter",
    speed: 1,
  }}
/>
```

Core props:

- `text`: rendered text. It must match a title compiled by the plugin when an
  outline is required.
- `outline`: precompiled glyph shard data, usually from
  `virtual:yuragi/outlines`.
- `sharedId`: a string wraps the rendered title in React Canary
  `ViewTransition` and uses this value as the shared element name. `false`
  explicitly disables the shared transition for that instance.
- `size`, `maxWidth`, `align`: layout controls for SVG text wrapping.
- `hover`: `"outline"` enables the hollow title hover effect.
- `fallback`: `"text"` renders readable text when `outline` is missing;
  `"hidden"` renders nothing; `"error"` throws.
- `transition.enter`: `"settle"` animates shards into place.
- `transition.exit`: `"scatter"` animates the previous title out when the title
  changes or unmounts.
- `transition.speed`: playback speed multiplier for both enter and exit. `1`
  is the default, values below `1` are slower, and values above `1` are faster.

Exit scatter is rendered in a fixed viewport overlay so the old title keeps its
screen position while React View Transition moves the new shared title. Exit
scatter and enter settle share the same x-position wave timing, so when a title
changes the outgoing and incoming shard waves visually line up from left to
right. The wave is based on each shard's visual x position, so wider titles get
a wider left-to-right timing spread. Enter and exit also share the same base
playback envelope, and `speed` scales that whole model; it is not a strict
millisecond duration.

## Runtime WASM API

Runtime compilation is available through the experimental WASM entry points.
Use this when titles are not known at build time or when users can provide their
own text.

```bash
pnpm add @yuragi/wasm
```

```tsx
import {
  YuragiFontProvider,
  YuragiText,
} from "@yuragi/react/wasm";
import "@yuragi/core/style.css";

export function RuntimeTitle({ title }: { title: string }) {
  return (
    <YuragiFontProvider
      font="/fonts/NotoSerifSC[wght].ttf"
      axes={{ wght: 900 }}
      preload={[title]}
    >
      <YuragiText
        text={title}
        sharedId={`title:${title}`}
        size={88}
        fallback="text"
        hover="outline"
        transition={{ enter: "settle", exit: "scatter", speed: 1 }}
      />
    </YuragiFontProvider>
  );
}
```

The provider owns the shared font compiler, caches compiled outlines in memory,
and renders readable fallback text until an outline is ready.

For non-React usage or advanced control:

```ts
import { createYuragiFont } from "@yuragi/wasm";

const font = await createYuragiFont({
  font: "/fonts/NotoSerifSC[wght].ttf",
  axes: { wght: 900 },
  preload: ["复杂分层"],
});

const outline = await font.compile("复杂分层");
font.dispose();
```

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

The playground includes controls for title size, transition speed, alignment,
and hover outline. The speed slider drives `transition.speed` directly.

## v1 Requirements

- React Canary with `ViewTransition`.
- Browser support for the View Transition API for shared element motion.
- All sharded strings must be listed in `titles`.
- Rust and Cargo on `PATH` for the v1 native compiler wrapper.
- Runtime font parsing uses the experimental `@yuragi/wasm` entry point.

## v1 Non-goals

- Automatic runtime source scanning.
- Stable React fallback.
- Source scanning.
- Markdown presets.
- Web Components.
