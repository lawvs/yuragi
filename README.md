# yuragi

Yuragi is a Rust-powered typography toolkit that breaks font glyphs into SVG
fragments and brings them to life with striking settle, scatter, and hover
animations. Use its React components with the built-in WASM runtime for dynamic
text, or compile outlines ahead of time for static builds.

The name comes from Japanese `揺らぎ`, a gentle swaying or flicker that echoes
`摇曳` and the subtle variation of the shard animation.

> Credits: Yuragi's original interaction study is inspired by the title
> animation in [Layered](https://github.com/CircuitCoder/layered), including
> the hollow hover treatment and scattered title transition. Special thanks to
> [喵喵](https://github.com/CircuitCoder) for the source of that visual idea.

## Packages

| Package | Purpose |
| --- | --- |
| `@yuragi-labs/react` | Recommended React 19 runtime API and static renderer. |
| `@yuragi-labs/core` | Shared outline types, layout helpers, SVG helpers, CSS, and lower-level runtime WASM compiler. |
| `@yuragi-labs/compiler` | Native build-time outline compiler. |

Package-specific options and lower-level APIs live in the package READMEs:

- [`@yuragi-labs/react`](packages/react/README.md)
- [`@yuragi-labs/core`](packages/core/README.md)
- [`@yuragi-labs/compiler`](packages/compiler/README.md)

## Install

```bash
pnpm add @yuragi-labs/react
```

## Quick Start

Use the runtime React API when titles are dynamic or you want the simplest
setup:

```tsx
import { YuragiFontProvider, YuragiText } from "@yuragi-labs/react";

export function Title() {
  return (
    <YuragiFontProvider font="/fonts/NotoSerifSC[wght].ttf">
      <YuragiText
        text="Dashboard"
        size={56}
        hover="outline"
      />
    </YuragiFontProvider>
  );
}
```

`YuragiFontProvider` loads the font and runtime compiler, caches compiled
outlines in memory, and renders fallback text until the outline is ready.

For build-time generated outlines, see the
[`@yuragi-labs/compiler` documentation](packages/compiler/README.md) and the
[static Vite example](examples/react-static-vite).

## Examples

Build the packages and both Vite examples:

```bash
pnpm install
pnpm examples:build
```

- [`examples/react-runtime-vite`](examples/react-runtime-vite) demonstrates
  the recommended runtime WASM API with dynamic text.
- [`examples/react-static-vite`](examples/react-static-vite) demonstrates an
  explicit compiler script and generated outlines.

Run an example locally:

```bash
pnpm --filter @yuragi-labs/example-react-runtime-vite dev
pnpm --filter @yuragi-labs/example-react-static-vite dev
```

## Playground

The interactive runtime demo, shard inspector, and WASM lab live in
[`apps/playground`](apps/playground). Its README documents fonts, generated
assets, and local development.

```bash
pnpm dev
```

## Development

The repository uses pnpm 11, Node.js 24, and Rust 1.85.

```bash
pnpm install
pnpm examples:build
pnpm typecheck
pnpm test
pnpm playground:build
```

## License

MIT © lawvs and CircuitCoder.
