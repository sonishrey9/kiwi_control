# Kiwi Control Release Packaging

## Release goal

The public beta release surface should look like a coherent Kiwi Control product:

- website is installer-first
- GitHub Releases is the source of truth for binaries
- release notes and checksums are public and easy to find
- beta wording stays honest about trust and signing status

Internal package names such as `sj-core`, `sj-cli`, and `sj-ui` remain implementation details.

## Release prep commands

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
npm run release:manifest
npm run release:checksums
npm run release:trust -- --platform macos --json
```

Desktop artifact build:

```bash
npm run ui:desktop:build
```

Release artifact build:

```bash
npm run ui:desktop:build:release
npm run release:verify-artifacts
npm run release:trust -- --platform macos --json
```

macOS release build on a Mac:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Example Corp (TEAMID)"
export APPLE_API_ISSUER="..."
export APPLE_API_KEY="..."
export APPLE_API_KEY_PATH="/absolute/path/AuthKey_XXXXXXX.p8"
npm run ui:desktop:build:release
node scripts/verify-release-artifacts.mjs --platform macos --bundles app,dmg
npm run release:trust -- --platform macos --json --strict
```

Windows release build on a Windows machine or Windows CI runner:

```powershell
$env:KIWI_CONTROL_TAURI_EXTRA_CONFIG="C:\\path\\to\\tauri.windows.signing.conf.json"
npm run ui:desktop:build:release
node scripts/verify-release-artifacts.mjs --platform windows --bundles nsis,msi
npm run release:trust -- --platform windows --json --strict
```

## Release assets

The release manifest is written to:

- `dist/release/release-manifest.json`

Checksums are written to:

- `dist/release/SHA256SUMS.txt`

Current public naming patterns include:

- `kiwi-control-cli-${version}-macos-aarch64.tar.gz`
- `kiwi-control-cli-${version}-macos-x64.tar.gz`
- `kiwi-control-cli-${version}-linux-x64.tar.gz`
- `kiwi-control-cli-${version}-windows-x64.zip`
- `kiwi-control-${version}-macos-aarch64.app.tar.gz`
- `kiwi-control-${version}-macos-x64.app.tar.gz`
- `kiwi-control-${version}-macos-aarch64.dmg`
- `kiwi-control-${version}-macos-x64.dmg`
- `kiwi-control-${version}-windows-x64-setup.exe`
- `kiwi-control-${version}-windows-x64.msi`
- `kiwi-control-${version}-linux-x64.AppImage`

Current source bundle output roots:

- `apps/sj-ui/src-tauri/target/release/bundle/macos/Kiwi Control.app`
- `apps/sj-ui/src-tauri/target/release/bundle/dmg/`
- `apps/sj-ui/src-tauri/target/release/bundle/nsis/`
- `apps/sj-ui/src-tauri/target/release/bundle/msi/`
- `apps/sj-ui/src-tauri/target/release/bundle/appimage/`

## Public release flow

The intended public beta path is:

1. publish binaries to GitHub Releases
2. publish checksums with the same release
3. keep the website aligned with the latest release
4. keep release notes explicit about signing, notarization, and trust status

Optional terminal commands are not part of the default desktop installer lane in this pass. They are enabled explicitly from first launch or later in-app, after the desktop app is already usable.

## Signing inputs

Official Tauri signing and notarization inputs used by this repo:

- macOS signing:
  - `APPLE_SIGNING_IDENTITY`
  - `APPLE_CERTIFICATE`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `KEYCHAIN_PASSWORD`
- macOS notarization preferred path:
  - `APPLE_API_ISSUER`
  - `APPLE_API_KEY`
  - `APPLE_API_KEY_PATH`
- macOS notarization fallback path:
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
- Windows signing:
  - `WINDOWS_CERTIFICATE_PFX_B64`
  - `WINDOWS_CERTIFICATE_PASSWORD`
  - `WINDOWS_CERTIFICATE_THUMBPRINT`
  - `WINDOWS_TIMESTAMP_URL`

## Website and downloads

- The website should point users to installers first, docs second
- The website should link to:
  - latest version
  - release notes
  - checksums
  - GitHub Releases as source of truth
- `/downloads` should remain a clear path back to the latest release stream

## Trust rules

- do not claim signed desktop trust unless signing was actually applied for that release
- do not claim notarized macOS trust unless notarization actually completed for that release
- do not claim auto-update support unless signed updater metadata ships
- use `npm run release:trust -- --platform macos --json` to classify a macOS build as `local-beta-build-only`, `signed-not-notarized`, or `signed-and-notarized`
- use `npm run release:trust -- --platform windows --json` on a Windows runner to verify installer signatures; macOS hosts can only report that the Windows path is wired, not prove installer trust
- do not claim Homebrew or winget availability unless those channels are actually published
- do not hide the Node 22+ requirement for the standalone beta CLI bundle

## Platform caveats

- macOS `.app` and `.dmg` artifacts can be built locally on macOS in this repo.
- A real signed and notarized macOS release still depends on Apple signing material being present in the environment.
- Windows NSIS and MSI packaging is wired in repo and CI, but real signed Windows installers must be built on Windows with the signing certificate available there.
- This macOS environment should not claim signed Windows installer output.
- Machine-wide terminal-command enablement on Windows must also be proven on a Windows runner because it depends on elevated machine PATH handling there.
- Windows SmartScreen reputation is not guaranteed by a successful signature check; OV/EV certificate reputation remains a distribution-channel reality, not something Kiwi can fake in repo scripts.

## Route 53 and website hosting

Current public-beta hosting split:

- Route 53 remains authoritative for `kiwi-ai.in`
- Cloudflare Pages hosts the public site
- GitHub Releases hosts the binaries

## Related docs

- [Install](./install.md)
- [Beta limitations](./beta-limitations.md)
- [Support](../SUPPORT.md)
- [Security and trust](./security-and-trust.md)
