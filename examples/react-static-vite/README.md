# Yuragi React Static Vite Example

Minimal Vite + React Canary example for Yuragi's static precompile escape hatch.
The app imports committed outline data and does not load a font or WASM compiler
at runtime.

## Run

Build the workspace packages, then start the example:

```bash
pnpm build
pnpm --filter @yuragi/example-react-static-vite dev
```

The generated outline JSON is committed so development, builds, and CI do not
depend on a font download or a local Rust toolchain.

The committed data was generated at `wght: 900` from Source Han Serif SC. See
the [upstream Source Han Serif repository](https://github.com/adobe-fonts/source-han-serif)
for the font source and license.

## Regenerate Outlines

Run the explicit TypeScript compiler script:

```bash
pnpm --filter @yuragi/example-react-static-vite generate
```

The script reads [`src/titles.json`](src/titles.json), calls
`compileOutlines`, and writes [`src/generated/outlines.json`](src/generated/outlines.json).
By default it downloads Source Han Serif SC to
`node_modules/.cache/yuragi/fonts`, verifies its SHA-256 checksum, and reuses
the cached file on later runs. Set `YURAGI_FONT` to override the default with a
local path or another `http:` or `https:` URL.

The compiler uses `wght: 900`; adjust the script when generating from a
different font or axis configuration.

Regeneration requires Rust and Cargo because `@yuragi/compiler` invokes the
native compiler. The Vite app itself only uses `@yuragi/react/static`.
