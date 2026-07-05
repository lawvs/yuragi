# @yuragi/react

React Canary components for rendering Yuragi text. The recommended entry uses
the runtime WASM compiler so text can be compiled on demand without a build-time
title list. Precompiled static outlines remain available as an escape hatch.

## Runtime WASM Entry

Import from `@yuragi/react` for the default runtime path:

```tsx
import { YuragiFontProvider, YuragiText } from "@yuragi/react";

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

`YuragiFontProvider` owns the shared font compiler, caches compiled outlines in
memory, and renders fallback text until an outline is ready. It includes
Yuragi's required styles by default.

Pass `includeStyles={false}` if your app imports `@yuragi/core/style.css`
manually, and pass `styleNonce` when your CSP requires a style nonce.

## Runtime Props

- `text`: rendered string.
- `sharedId`: string shared element name for React Canary `ViewTransition`;
  `false` disables shared motion for that instance.
- `size`: text size in CSS pixels.
- `maxWidth`: wrapping width.
- `align`: `"start"`, `"center"`, or `"end"`.
- `hover`: `"outline"` enables the hollow title hover treatment;
  `"none"` disables it.
- `fallback`: `"text"` renders readable text while the outline is compiling;
  `"hidden"` renders nothing; `"error"` throws.
- `transition.enter`: `"settle"` animates shards into place.
- `transition.exit`: `"scatter"` animates the previous title out when the title
  changes or unmounts.
- `transition.speed`: playback speed multiplier. `1` is the default, values
  below `1` are slower, and values above `1` are faster.
- `className`, `style`: applied to the root element.

Exit scatter is rendered in a fixed viewport overlay so the old title keeps its
screen position while React View Transition moves the new shared title. Enter
and exit use the same x-position wave timing, which helps outgoing and incoming
titles line up visually during page changes.

## Static Precompiled Escape Hatch

Use `@yuragi/react/static` when titles are known at build time and you want to
avoid the runtime compiler:

```tsx
import { YuragiStyles, YuragiText } from "@yuragi/react/static";
import outlines from "virtual:yuragi/outlines";

export function StaticTitle() {
  return (
    <>
      <YuragiStyles />
      <YuragiText
        text="Dashboard"
        outline={outlines["Dashboard"]}
        sharedId="title:dashboard"
        size={56}
        maxWidth={760}
        align="start"
        hover="outline"
        fallback="text"
        transition={{ enter: "settle", exit: "scatter", speed: 1 }}
      />
    </>
  );
}
```

Static `YuragiText` accepts the same visual and transition props as runtime
`YuragiText`, plus:

- `outline`: compiled shard outline, usually from `virtual:yuragi/outlines`.

## `YuragiStyles`

`YuragiStyles` renders Yuragi's small stylesheet as a React `<style>` element.
Render it once near your app root when using the static entry.

```tsx
<YuragiStyles nonce={nonce} />
```

If your app imports `@yuragi/core/style.css` directly, do not render
`YuragiStyles`.

## Requirements

- React Canary and React DOM Canary.
- Browser support for React's `ViewTransition` integration when `sharedId` is
  used.
- A font file that can be loaded by the runtime provider or the static compiler.
