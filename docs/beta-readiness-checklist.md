# Kiwi Control 0.2.0-beta.1 Readiness Checklist

This checklist is for a local-first public beta. It is intentionally honest about what is install-ready, what is source-ready, and what still remains manual before public release.

## Go / No-Go

- `GO` if the workspace builds, tests pass, smoke test passes, and the installed command story is clearly `kiwi-control` / `kc`.
- `GO` if the desktop path is documented clearly enough that an installed user understands `kiwi-control ui` and a contributor understands `npm run ui:dev`.
- `GO` if release manifest generation, artifact naming, Homebrew templates, and winget templates all match the visible Kiwi Control brand.
- `NO-GO` if repo-local artifacts stop being the source of truth.
- `NO-GO` if the desktop app starts owning hidden authoritative state.
- `NO-GO` if the release docs imply universal MCP/runtime parity or strict Copilot orchestration.
- `NO-GO` if signing, notarization, or updater trust steps are described as automatic when they are still manual.

## What works for installed users

- download the Kiwi Control CLI bundle from GitHub Releases
- run the included `install.sh` or `install.ps1`
- run `kiwi-control --help`
- run `kiwi-control init --target /path/to/repo`
- run `kiwi-control status --target /path/to/repo`
- run `kiwi-control check --target /path/to/repo`
- run `kiwi-control checkpoint "<milestone>" --target /path/to/repo`
- run `kiwi-control handoff --target /path/to/repo --to claude`
- run `kiwi-control ui --json --target /path/to/repo`

## What works for source contributors

- `npm install`
- `npm run build`
- `npm run cli -- status --target .`
- `npm run ui:dev`
- `npm test`
- `bash scripts/smoke-test.sh`

## What builds as packages

- workspace TypeScript build via `npm run build`
- staged CLI bundle via `node scripts/prepare-release-manifest.mjs`
- desktop web assets via `npm run build -w @shrey-junior/sj-ui`
- desktop packaging preflight via `npm run ui:desktop:build`
- release manifest via `node scripts/prepare-release-manifest.mjs`

Desktop bundle generation still requires Rust/Cargo and the platform-native desktop toolchain.

## What remains manual before public release

- publish GitHub Release artifacts
- install Rust/Cargo on each desktop release builder
- complete macOS code signing and notarization
- complete Windows Authenticode signing
- generate and configure updater signing keys
- fill in real release URLs and checksums for Homebrew and winget publication

## First command for a new installed user

After installing the CLI bundle:

```bash
kiwi-control init --target /path/to/repo
```

## First commands for a contributor

```bash
npm install && npm run build
```

## Beta sign-off notes

- visible product name is `Kiwi Control`
- internal package boundaries remain `sj-core`, `sj-cli`, and `sj-ui`
- repo-local schema and artifact IDs remain `shrey-junior/*` during beta for backward compatibility
- compatibility CLI aliases `shrey-junior` and `sj` still exist, but user-facing docs and commands should prefer `kiwi-control` and `kc`
