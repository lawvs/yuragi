# @yuragi/core

Shared types, layout helpers, SVG helpers, outline providers, animation helpers,
and CSS for Yuragi packages.

Most applications use this package indirectly through `@yuragi/react`. React
users usually render `YuragiStyles`; import the CSS file directly only when you
want to manage Yuragi styles through your app or bundler:

```tsx
import "@yuragi/core/style.css";
```

## Static Outline Provider

`createStaticOutlineProvider` wraps a compiled outline map with a small provider
interface:

```ts
import { createStaticOutlineProvider } from "@yuragi/core";
import outlines from "virtual:yuragi/outlines";

const provider = createStaticOutlineProvider(outlines);

const cached = provider.get("Dashboard");
const required = await provider.resolve("Dashboard");
await provider.preload(["Dashboard"]);
```

The provider is useful when code wants the same shape for build-time outlines
and runtime outlines.

## Important Types

```ts
import type {
  OutlineMap,
  OutlineProvider,
  ShardTransitionOptions,
  TextOutline,
  TextOutlineBundle,
} from "@yuragi/core";
```

- `TextOutlineBundle`: compiled font metadata plus an outline map.
- `OutlineMap`: title string to outline mapping.
- `TextOutline`: glyph shard geometry for one rendered string.
- `OutlineProvider`: `get`, `resolve`, and `preload` interface.
- `ShardTransitionOptions`: shared transition options used by renderers.

## CSS Export

The package exports:

```ts
import "@yuragi/core/style.css";
```

The stylesheet defines the classes used by the React renderer and should be
included exactly once in the application.

`@yuragi/core` also exports `YURAGI_STYLE_TEXT` for renderers that need to
declare the stylesheet in another environment, such as `@yuragi/react`'s
`YuragiStyles` component. Most React users should import `YuragiStyles` from
`@yuragi/react` instead of using this value directly.
