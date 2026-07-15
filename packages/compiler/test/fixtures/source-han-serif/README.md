# Source Han Serif regression snapshots

These JSON file snapshots contain glyph outlines derived from Source Han Serif
SC 2.003R. Adobe distributes the font under the SIL Open Font License 1.1; the
copyright notice and license are reproduced in `OFL.txt`.

The font binary is not stored in this repository. Tests download the exact file
from Adobe's `7889f11bf31170b5d092a083b357c8c8130f89e0` commit and verify this
SHA-256 digest before use:

```text
24980e3fdbdf7cbef800133c9bc8937cb65533ca50f0bd0565115db496f57220
```

Snapshots use the Playground Shard Inspector catalog and `wght: 900`. The five
committed JSON files are the baselines; SVGs are generated only when a snapshot
fails. Failure diagnostics are written to `.artifacts/font-regression/` with a
section atlas, red/cyan overlay, per-glyph overlays, and a field-level summary.

Run the test normally and inspect those diagnostics before accepting an
intentional change with Vitest's snapshot update flag:

```sh
pnpm --filter @yuragi-labs/compiler exec vitest run test/font-regression.test.ts
pnpm --filter @yuragi-labs/compiler exec vitest run test/font-regression.test.ts -u
```
