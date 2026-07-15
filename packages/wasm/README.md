# @yuragi-labs/wasm

Lower-level runtime WASM compiler for Yuragi. React applications should prefer
`YuragiFontProvider` and `YuragiText` from `@yuragi-labs/react`; use this package
directly for custom runtime integrations.

## Font API

```ts
import { createYuragiFont, type FontAxes } from "@yuragi-labs/wasm";

const axes = { wght: 900 } satisfies FontAxes;

const font = await createYuragiFont({
  font: "/fonts/NotoSerifSC[wght].ttf",
  axes,
  preload: ["复杂分层"],
});

const outline = await font.compile("复杂分层");
font.dispose();
```

`createYuragiFont` loads the WASM compiler, loads the font, and returns a
`YuragiFont` object with:

- `info`: font metadata reported by the runtime.
- `compile(text, options?)`: compile one string into a `TextOutline`.
- `preload(texts?)`: compile and cache a group of strings.
- `dispose()`: release the runtime reference and clear the in-memory cache.

## Sources

`font` and `wasm` accept:

```ts
type BinarySource =
  | string
  | URL
  | ArrayBuffer
  | Uint8Array
  | (() => BinarySource | Promise<BinarySource>);
```

String and URL sources use `fetch`. Pass a custom `fetch` implementation when
running in an environment without `globalThis.fetch`.

`FontAxes` includes common OpenType variation axis tags such as `wght`, `wdth`,
`opsz`, `slnt`, and `ital`, while still allowing custom tags from specific
fonts.

## Lower-Level Runtime

For advanced control, instantiate the runtime directly:

```ts
import { YuragiWasmRuntime } from "@yuragi-labs/wasm";

const runtime = await YuragiWasmRuntime.load(wasmBytes);
const info = runtime.setFont(fontBytes);
const outline = runtime.compileTitle("Dashboard", { wght: 900 });
```

Most applications should use `createYuragiFont` directly only for custom
runtime integrations. React applications should use the provider from
`@yuragi-labs/react`.
