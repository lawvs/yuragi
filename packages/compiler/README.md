# @yuragi/compiler

Build-time compiler wrapper for Yuragi text outlines.

This package invokes the native Rust compiler through Cargo at runtime.
Consumers must have Rust and Cargo available on `PATH`. Cargo build artifacts
are written to a deterministic cache directory under the OS temp directory, not
inside the installed package.

## API

```ts
import { compileOutlines, type FontAxes } from "@yuragi/compiler";

const axes = { wght: 900 } satisfies FontAxes;

const bundle = await compileOutlines({
  font: "./fonts/title.otf",
  axes,
  titles: ["Dashboard", "Settings"],
});
```

`titles` can also be an async function:

```ts
const bundle = await compileOutlines({
  font: "./fonts/title.otf",
  titles: async () => ["Dashboard", "Settings"],
});
```

The compiler deduplicates title strings before invoking the native compiler.

## Options

- `font`: font file path.
- `axes`: optional `FontAxes` variation axis values for variable fonts.
- `titles`: explicit strings to compile, or an async function that returns them.

The output is a `TextOutlineBundle` from `@yuragi/core`.

## Native Compiler

The package ships the Rust source under `native/` and runs Cargo against it.
The compiled binary is cached outside the package directory so installed package
contents are not mutated.
