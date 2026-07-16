# Yuragi Playground

The playground contains Yuragi's runtime demo, shard inspector, and
experimental WASM lab. Its landing title is rendered by Yuragi itself using a
precompiled static outline, so the first visual does not wait for the runtime
font or WASM compiler.

## Run locally

From the repository root:

```bash
pnpm install
pnpm dev
```

Create a production build with:

```bash
pnpm playground:build
```

Both commands compile the Rust WASM module before Vite starts. The generated
module is written to
`apps/playground/public/yuragi-wasm/yuragi_wasm_compiler.wasm`, copied into the
production build, and ignored by Git.

## Hero outline

The committed `src/hero/hero-outline.json` asset is generated from the pinned
Source Han Serif font through `@yuragi-labs/compiler` and rendered through
`@yuragi-labs/react/static`.

Regenerate it after changing the font or outline compiler:

```bash
pnpm build
pnpm --filter @yuragi-labs/playground hero:generate
```

Keeping this small outline in the repository makes the landing title available
immediately and keeps production builds independent of the font download.
Hero generation ignores `YURAGI_FONT` and verifies the pinned font checksum so
local playground overrides cannot change the committed baseline.

## Playground font

The default title font is `SourceHanSerifSC-VF.otf` at `wght: 900`, matching
the font used by Layered. During local development it is downloaded on first
run and cached under the repository-root `node_modules/.cache/yuragi/fonts`.

Use a local font instead:

```bash
YURAGI_FONT="/path/to/title-font.otf" pnpm dev
```

`YURAGI_FONT` also accepts an `http:` or `https:` URL. Remote fonts are
downloaded into the same shared cache. Production builds use the configured
remote default and do not commit font files to the repository.

## Requirements

- Node.js 24 and pnpm 11.
- Rust 1.85 through `rustup`.
- The `wasm32-unknown-unknown` target; the WASM build script installs it when
  needed.
