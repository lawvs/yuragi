# Yuragi React Runtime Vite Example

Minimal Vite + React Canary example for Yuragi's recommended runtime WASM API.

This example uses:

- `YuragiFontProvider` from `@yuragi/react`
- runtime `YuragiText`
- dynamic title input
- hover outline
- settle/exit transition controls

It intentionally does not use `@yuragi/react/static`, `@yuragi/unplugin`,
`virtual:yuragi/outlines`, or a custom worker.

## Run From This Repository

Build the workspace packages first so the example uses the same package exports
that a user project will use:

```bash
pnpm install
pnpm build
pnpm --filter @yuragi/example-react-runtime-vite dev
```

Build the example:

```bash
pnpm --filter @yuragi/example-react-runtime-vite build
```

Or run the root helper:

```bash
pnpm examples:build
```

## Font

The example uses a remote Source Han Serif SC variable font URL so it can run
without committing a large font file.

For production, prefer hosting the font in your app:

```tsx
<YuragiFontProvider font="/fonts/NotoSerifSC[wght].ttf" axes={{ wght: 900 }}>
  <YuragiText text={title} />
</YuragiFontProvider>
```

The runtime provider needs font bytes, so CSS `font-family` alone is not enough
for shard compilation.
