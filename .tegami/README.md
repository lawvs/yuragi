# Release process

This directory stores pending Tegami changelog files and the publish lock that
Tegami writes during versioning.

Tegami documentation:

- https://tegami.fuma-nama.dev
- https://tegami.fuma-nama.dev/changelog

## Changelog entries

Create a changelog entry for user-facing package changes:

```sh
pnpm tegami
```

The interactive prompt writes pending changelog files to this directory as
`YYYY-MM-DD-{hash}.md`.

For the four published Yuragi packages, select the `yuragi` group unless the
change should intentionally apply to only part of the package set.

Do not edit package `CHANGELOG.md` files or `.tegami/publish-lock.yaml`
directly. Tegami updates those when it versions packages.

## Pull request preview

Preview changelog and version impact for a pull request:

```sh
pnpm tegami pr preview --number <pr-number>
```

## Release checks

Run the full pre-publish check locally before release-sensitive changes:

```sh
pnpm release:check
```

This builds packages and examples, runs typecheck and tests, packs the four
published packages, installs the tarballs into a temporary consumer project,
and runs the release smoke test.

## CI release flow

The Release workflow runs on pushes to `main` and manual dispatches.

It runs:

```sh
pnpm release:check
pnpm tegami ci
```

If pending changelog entries exist, Tegami creates or updates the version PR on
`tegami/version-packages`. After that version PR is merged, the next Release
workflow publishes packages from the publish lock.

Publishing is intended to happen in CI through npm Trusted Publishing, not from
local npm tokens.

Configure npm Trusted Publisher for each published package with:

- repository: `lawvs/yuragi`
- workflow filename: `release.yml`
- allowed action: `npm publish`
