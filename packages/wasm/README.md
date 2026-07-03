# @yuragi/wasm

Experimental runtime WASM compiler for Yuragi. Use it when titles are not known
at build time or when users can provide their own text.

## Font API

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

## Lower-Level Runtime

For advanced control, instantiate the runtime directly:

```ts
import { YuragiWasmRuntime } from "@yuragi/wasm";

const runtime = await YuragiWasmRuntime.load(wasmBytes);
const info = runtime.setFont(fontBytes);
const outline = runtime.compileTitle("Dashboard", { wght: 900 });
```

Most applications should use `createYuragiFont` or the React provider from
`@yuragi/react/wasm` instead.
