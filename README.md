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
      transition={{ enter: "settle", exit: "scatter" }}
    />
  );
}
```

## Playground

The playground includes Space Grotesk at `apps/playground/fonts/title.ttf`
under the SIL Open Font License. To try another font, provide a path at build
time:

```bash
TYPE_SHARDS_FONT="/path/to/title-font.otf" pnpm playground:build
```

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
