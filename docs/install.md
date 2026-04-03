# Install

Shrey Junior is designed to be installable as a local product, but this repository is still in the public-beta packaging stage.

## Current supported path: build from source

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
```

CLI entrypoint from source:

```bash
node packages/sj-cli/dist/cli.js status --target /path/to/repo
```

Desktop shell from source:

```bash
npm run ui:dev
```

## Planned release channels

The repo now includes scaffolding for:

- GitHub Releases artifacts
- Homebrew for the CLI
- winget for Windows
- desktop bundles for macOS, Windows, and Linux via `sj-ui`

Those channels are prepared but not yet published from this repository.

## Install model

The intended product shape is:

1. Install Shrey Junior once on a laptop.
2. Point it at any supported repo.
3. Keep all operational truth repo-local under `.agent/` plus native repo instruction surfaces.
4. Use machine-global files only as accelerators, never as authority.

## Trust model

- core operation is local-first
- repo-local artifacts remain authoritative
- no hidden database is required for the CLI or desktop app
- no cloud backend is required for core operation
- signing and updater trust still need release-time platform setup

## Next installation milestone

Before public beta publication:

- configure signing keys for desktop bundles
- publish the CLI package and release artifacts
- activate the Homebrew and winget channels with live URLs
