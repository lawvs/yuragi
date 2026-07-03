# @yuragi/unplugin

Build-time outline plugin for Yuragi. It compiles a configured set of strings
into `virtual:yuragi/outlines`, which can be rendered by `@yuragi/react`.

## Vite

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

Then import outlines from the virtual module:

```ts
import outlines, {
  bundle,
  provider,
} from "virtual:yuragi/outlines";
```

The default export is the outline map. The named exports are:

- `bundle`: compiled font metadata and outline map.
- `provider`: `createStaticOutlineProvider(bundle.outlines)`.
- `createStaticOutlineProvider`: re-export from `@yuragi/core`.

## Options

```ts
type YuragiPluginOptions = {
  font: string;
  axes?: Record<string, number>;
  titles: string[] | (() => string[] | Promise<string[]>);
};
```

- `font`: local font path passed to the compiler wrapper.
- `axes`: variation axis values for variable fonts.
- `titles`: explicit strings to compile, or an async function that returns them.

`titles` is intentionally explicit. Yuragi does not scan source files for text.

## Other Bundlers

The package exports unplugin adapters for:

```ts
import Yuragi from "@yuragi/unplugin/rollup";
import Yuragi from "@yuragi/unplugin/webpack";
import Yuragi from "@yuragi/unplugin/esbuild";
import Yuragi from "@yuragi/unplugin/rspack";
```

The default export from `@yuragi/unplugin` is the raw unplugin instance.
