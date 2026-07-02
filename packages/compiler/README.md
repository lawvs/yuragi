# @yuragi/compiler

Build-time compiler wrapper for Type Shards text outlines.

This v1 package invokes the native Rust compiler through Cargo at runtime.
Consumers must have Rust and Cargo available on `PATH`. Cargo build artifacts
are written to a deterministic cache directory under the OS temp directory, not
inside the installed package.
