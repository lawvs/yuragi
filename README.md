# type-shards

`type-shards` renders text as SVG glyph fragments and animates those fragments
with hover outline, settle, and scatter effects.

## Install

```bash
pnpm add @type-shards/react @type-shards/core
pnpm add -D @type-shards/unplugin @type-shards/compiler
```

## Configure the plugin

```ts
import TypeShards from "@type-shards/unplugin/vite";

export default {
  plugins: [
    TypeShards({
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
/// <reference types="@type-shards/unplugin/client" />
```

```tsx
import { ShardedText } from "@type-shards/react";
import outlines from "virtual:type-shards/outlines";
import "@type-shards/core/style.css";

export function Title() {
  return (
    <ShardedText
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

`ShardedText` is the v1 React entry point:

```tsx
<ShardedText
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
  `virtual:type-shards/outlines`.
- `sharedId`: wraps the rendered title in React Canary `ViewTransition` and
  uses this value as the shared element name.
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
right. The speed value scales this whole playback model; it is not a strict
millisecond duration.

## Playground

The playground uses the same title font as Layered:
`SourceHanSerifSC-VF.otf` at `wght: 900`. The font is downloaded on first
build to Vite's cache under `apps/playground/node_modules/.vite/type-shards`
and is not committed to this repository.

To use a local font file instead:

```bash
TYPE_SHARDS_FONT="/path/to/title-font.otf" pnpm playground:build
```

`TYPE_SHARDS_FONT` can also be an `http:` or `https:` URL; remote fonts are
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
- Runtime font parsing is not included in v1.

## v1 Non-goals

- Runtime WASM font parsing.
- Stable React fallback.
- Source scanning.
- Markdown presets.
- Web Components.
