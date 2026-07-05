# @yuragi/core

Shared types, layout helpers, SVG helpers, animation helpers, and CSS for
Yuragi packages.

Most applications use this package indirectly through `@yuragi/react`. Static
React users usually render `YuragiStyles` from `@yuragi/react/static`; import
the CSS file directly only when you want to manage Yuragi styles through your
app or bundler:

```tsx
import "@yuragi/core/style.css";
```

## Important Types

```ts
import type {
  OutlineMap,
  ShardTransitionOptions,
  TextOutline,
  TextOutlineBundle,
} from "@yuragi/core";
```

- `TextOutlineBundle`: compiled font metadata plus an outline map.
- `OutlineMap`: title string to outline mapping.
- `TextOutline`: glyph shard geometry for one rendered string.
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
static `YuragiStyles` component. Most React users should import
`YuragiStyles` from `@yuragi/react/static` instead of using this value directly.
