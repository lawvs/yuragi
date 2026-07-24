## @yuragi-labs/core@0.2.0

### Add controllable shard animation handles

Replace `animateShards()` with `prepareShardAnimation()`. The returned handle
separates synchronous initial-frame preparation from `play()`, supports
`cancel()`, and exposes a non-rejecting `finished` Promise with explicit
completed, cancelled, skipped, and failed results.

### Enable animations by default

YuragiText now enables settle and scatter animations unless explicitly disabled. Replace the transition prop with animation, using booleans for enter and exit.
