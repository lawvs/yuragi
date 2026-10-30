---
packages:
  "@yuragi-labs/core":
    type: minor
  "@yuragi-labs/react":
    type: minor
---

## Select rendered text

Rendered SVG text now supports native text selection by default. Set
`selectable: false` in core or `selectable={false}` in React to disable it.
Selection follows the final text layout without changing fragment animations.
