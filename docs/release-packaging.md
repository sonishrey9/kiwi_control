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
```

Desktop artifact build:

```bash
npm run ui:desktop:build
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
- `kiwi-control-${version}-macos-aarch64.dmg`
- `kiwi-control-${version}-macos-x64.dmg`
- `kiwi-control-${version}-windows-x64.msi`
- `kiwi-control-${version}-linux-x64.AppImage`

## Public release flow

The intended public beta path is:

1. publish binaries to GitHub Releases
2. publish checksums with the same release
3. keep the website aligned with the latest release
4. keep release notes explicit about signing, notarization, and trust status

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
- do not claim auto-update support unless signed updater metadata ships
- do not claim Homebrew or winget availability unless those channels are actually published
- do not hide the Node 22+ requirement for the standalone beta CLI bundle

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
