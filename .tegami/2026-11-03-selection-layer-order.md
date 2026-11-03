---
packages:
  "@yuragi-labs/core":
    type: patch
---

## Keep selected text visible

Render the selection layer behind glyph fragments so opaque selection
backgrounds do not hide the text. Let pointer events reach that layer when
selection is enabled, while preserving shard interaction when it is disabled.
