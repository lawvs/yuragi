# Release process

This directory stores pending Tegami changelog files and the publish lock.

Tegami documentation:

- https://tegami.fuma-nama.dev
- https://tegami.fuma-nama.dev/changelog

## Changelog

Create a changelog entry for user-facing package changes:

```sh
pnpm tegami
```

Preview changelog and version impact for a pull request:

```sh
pnpm tegami pr preview --number <pr-number>
```

Use the `yuragi` group for changes that affect all published packages. Do not
edit package `CHANGELOG.md` files or `.tegami/publish-lock.yaml` directly.

## CI release flow

The Release workflow runs on pushes to `main` and manual dispatches:

```sh
pnpm release:check
pnpm tegami ci
```

If pending changelog entries exist, Tegami creates or updates the version PR.
After that version PR is merged, the next Release workflow publishes packages
from the publish lock.

Publishing should happen in CI through npm Trusted Publishing. Configure each
published package with:

- repository: this GitHub repository
- workflow filename: `release.yml`
- allowed action: `npm publish`
