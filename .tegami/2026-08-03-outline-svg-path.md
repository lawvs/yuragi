---
packages:
  "@yuragi-labs/core":
    type: minor
---

## Export static SVG path geometry

Add `outlineToSvgPath` for DOM-free integrations that need a single SVG path.
It reuses Yuragi's text layout, flattens glyph positions and font scaling into
the path coordinates, and returns the corresponding view box.
