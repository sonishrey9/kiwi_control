# Kiwi Control Signing and Verification

Kiwi Control is local-first and works without a cloud backend, but trusted public beta distribution still depends on release-time signing and verification work.

Public commands remain:

- `kiwi-control`
- `kc`

## What is already true

- The CLI, runtime assets, and desktop shell can be built from source without hidden remote services.
- Repo-local artifacts remain the source of truth for runtime state.
- The desktop app is only a local control surface over repo-local state.

## What is still manual for `0.2.0-beta.1`

### macOS signing and notarization

1. Install Xcode command line tools.
2. Import the Developer ID Application certificate into the macOS keychain.
3. Export these environment variables for the release build:
   - `APPLE_SIGNING_IDENTITY`
   - `APPLE_TEAM_ID`
   - `APPLE_ID`
   - `APPLE_APP_SPECIFIC_PASSWORD`
4. Run `npm run ui:desktop:build` on macOS.
5. Notarize the generated `.app` / `.dmg` artifacts before marking them trusted in release notes.

### Windows signing

1. Import the code-signing certificate on the Windows release machine.
2. Export:
   - `WINDOWS_CODESIGN_CERT_SHA1`
   - `WINDOWS_CODESIGN_PASSWORD`
3. Run `npm run ui:desktop:build` on Windows.
4. Verify the resulting MSI or EXE shows the expected signer before publishing.

### Tauri updater signing

1. Generate and protect the Tauri updater private key.
2. Export:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. Regenerate `apps/sj-ui/src-tauri/updater.json` during release packaging.
4. Do not claim updater support is active until signed updater metadata ships with a real release.

## Linux packaging note

Linux desktop bundles can be built locally for beta evaluation, but distro-specific signing and repository publication remain a manual policy choice. Do not over-claim Linux signing coverage until the chosen format and signing flow are documented per distro.

## Release verification checklist

Before publishing a public beta release:

1. Run `npm run build`.
2. Run `npm test`.
3. Run `bash scripts/smoke-test.sh`.
4. Run `npm run ui:build`.
5. Run `npm run ui:desktop:build` on every target platform with the correct toolchain installed.
6. Generate `dist/release/release-manifest.json`.
7. Publish SHA256 checksums for every release artifact.
8. Confirm the Homebrew and winget templates point at the same artifact names used in the GitHub Release.
9. State clearly which artifacts are signed and which are still unsigned.

## Honesty rule

If signing, notarization, or updater steps were skipped for a release, say so in the release notes. Kiwi Control should never imply trust guarantees that were not actually applied.
