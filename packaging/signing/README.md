# Kiwi Control Signing and Verification

Kiwi Control is local-first and works without a cloud backend, but trusted public beta distribution still depends on release-time signing and verification work.

Public commands remain:

- `kiwi-control`
- `kc`

## What is already true

- The CLI, runtime assets, and desktop shell can be built from source without hidden remote services.
- Repo-local artifacts remain the source of truth for runtime state.
- The desktop app is only a local control surface over repo-local state.

## What is wired in repo for `0.2.0-beta.1`

- Tauri release overlay config for macOS `app,dmg` and Windows `nsis,msi`
- release workflow hooks for macOS certificate import and notarization-key file wiring
- release workflow hooks for Windows PFX import and temporary Tauri signing overlay generation
- release artifact verification script:

```bash
node scripts/verify-release-artifacts.mjs --platform macos --bundles app,dmg
node scripts/verify-release-artifacts.mjs --platform windows --bundles nsis,msi
```

## What still depends on release environment inputs

### macOS signing and notarization

1. Install Xcode command line tools.
2. Import the Developer ID Application certificate into the macOS keychain.
3. Export these environment variables for the release build:
   - signing:
     - `APPLE_SIGNING_IDENTITY`
     - `APPLE_CERTIFICATE`
     - `APPLE_CERTIFICATE_PASSWORD`
     - `KEYCHAIN_PASSWORD`
   - notarization preferred path:
     - `APPLE_API_ISSUER`
     - `APPLE_API_KEY`
     - `APPLE_API_KEY_PATH`
   - notarization fallback path:
     - `APPLE_ID`
     - `APPLE_PASSWORD`
     - `APPLE_TEAM_ID`
4. Run `npm run ui:desktop:build` on macOS.
5. Notarize the generated `.app` / `.dmg` artifacts before marking them trusted in release notes.

### Windows signing

1. Import the code-signing certificate on the Windows release machine.
2. Export:
   - `WINDOWS_CERTIFICATE_PFX_B64`
   - `WINDOWS_CERTIFICATE_PASSWORD`
   - `WINDOWS_CERTIFICATE_THUMBPRINT`
   - `WINDOWS_TIMESTAMP_URL`
3. Run `npm run ui:desktop:build:release` on Windows.
4. Verify both the NSIS installer (`-setup.exe`) and MSI show the expected signer before publishing.

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
5. Run `npm run ui:desktop:build:release` on every target platform with the correct toolchain installed.
6. Run `npm run release:verify-artifacts` or the platform-specific verifier command.
7. Generate `dist/release/release-manifest.json`.
8. Publish SHA256 checksums for every release artifact.
9. Confirm the Homebrew and winget templates point at the same artifact names used in the GitHub Release.
10. State clearly which artifacts are signed and which are still unsigned.

## Honesty rule

If signing, notarization, or updater steps were skipped for a release, say so in the release notes. Kiwi Control should never imply trust guarantees that were not actually applied.
