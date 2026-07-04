# @yuragi/react

React Canary components for rendering Yuragi text from precompiled outlines or
from the experimental runtime WASM compiler.

## Static Outlines

Use the build-time plugin to compile titles, then render with `YuragiText`:

```tsx
import { YuragiStyles, YuragiText } from "@yuragi/react";
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

## `YuragiStyles`

`YuragiStyles` renders Yuragi's small stylesheet as a React `<style>` element.
Render it once near your app root when using the static entry.

```tsx
<YuragiStyles nonce={nonce} />
```

If your app imports `@yuragi/core/style.css` directly, do not render
`YuragiStyles`.

## `YuragiText` Props

- `text`: rendered string.
- `outline`: compiled shard outline, usually from `virtual:yuragi/outlines`.
- `sharedId`: string shared element name for React Canary `ViewTransition`;
  `false` disables shared motion for that instance.
- `size`: text size in CSS pixels.
- `maxWidth`: wrapping width.
- `align`: `"start"`, `"center"`, or `"end"`.
- `hover`: `"outline"` enables the hollow title hover treatment;
  `"none"` disables it.
- `fallback`: `"text"` renders readable text when an outline is missing;
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

## Runtime WASM Entry

Use `@yuragi/react/wasm` when text is not known at build time:

```tsx
import {
  YuragiFontProvider,
  YuragiText,
} from "@yuragi/react/wasm";

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
and renders fallback text until an outline is ready.

`YuragiFontProvider` includes `YuragiStyles` by default. Pass
`includeStyles={false}` if your app imports `@yuragi/core/style.css` manually,
and pass `styleNonce` when your CSP requires a style nonce.

## Requirements

- React Canary and React DOM Canary.
- Browser support for React's `ViewTransition` integration when `sharedId` is
  used.
- `YuragiStyles` rendered once for the static entry, or
  `@yuragi/core/style.css` imported manually. The runtime provider includes
  styles by default.
