# Kiwi Control Release Packaging

## Release goal

The release surface must look like a finished Kiwi Control product:

- product name: `Kiwi Control`
- primary command: `kiwi-control`
- short alias: `kc`
- desktop app name: `Kiwi Control`
- GitHub Releases as the primary public beta distribution path
- Cloudflare Pages as the public landing/docs/download discovery surface

Internal package boundaries remain `sj-core`, `sj-cli`, and `sj-ui`. Repo-local schema and artifact IDs remain `shrey-junior/*` for beta compatibility.

## Versioning

Current release strategy:

- `0.x` for public beta and rapid iteration
- `-beta.N` suffix for prereleases
- aligned versions across `sj-core`, `sj-cli`, and `sj-ui`

The current target is `0.2.0-beta.1`.

## Exact release prep commands

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
npm run ui:build
node scripts/prepare-release-manifest.mjs
node scripts/generate-release-checksums.mjs
```

For desktop packaging on a machine with the native toolchain installed:

```bash
npm run ui:desktop:build
```

## What `prepare-release-manifest` now stages

`node scripts/prepare-release-manifest.mjs` now does two things:

1. writes `dist/release/release-manifest.json`
2. stages a public CLI bundle at `dist/release/cli-bundle`

Release checksums are generated separately by:

```bash
node scripts/generate-release-checksums.mjs
```

The staged CLI bundle contains:

- `bin/kiwi-control`
- `bin/kc`
- `bin/shrey-junior`
- `bin/sj`
- Windows `.cmd` launchers for the same commands
- `install.sh`
- `install.ps1`
- `lib/cli.js`
- `README.md`

That staged bundle is the public beta CLI artifact shape. It lets end users install Kiwi Control without needing the repo checkout or contributor-only scripts.

## Artifact naming

Release artifact naming is generated from `sj-core` product metadata by `scripts/prepare-release-manifest.mjs`.

Current visible naming patterns:

- `kiwi-control-cli-${version}-macos-aarch64.tar.gz`
- `kiwi-control-cli-${version}-macos-x64.tar.gz`
- `kiwi-control-cli-${version}-linux-x64.tar.gz`
- `kiwi-control-cli-${version}-windows-x64.zip`
- `kiwi-control-runtime-${version}-${os}-${arch}.tar.gz`
- `kiwi-control-ui-web-${version}-${os}-${arch}.tar.gz`
- `kiwi-control-${version}-${os}-${arch}.${ext}`

The generated manifest is written to:

- `dist/release/release-manifest.json`

The desktop packaging flow also stages installer resources under `apps/sj-ui/src-tauri/resources/desktop/` during `npm run ui:desktop:build`. That staged resource set now includes:

- the reusable CLI bundle
- desktop-first install scripts for `kc`
- an embedded Node runtime used by the installed desktop product during beta

## Public install story

For the first beta, public docs should teach this exact order:

1. download the Kiwi Control desktop installer from GitHub Releases
2. install the desktop app
3. launch Kiwi Control once
4. use the onboarding flow to install `kc`, choose a repo, and initialize it if needed
5. use `kc ui` from Terminal after first launch when you want repo-to-desktop handoff

The standalone CLI bundle remains available, but the normal-user path on Windows and macOS should now start from the desktop installer.

`kiwi-control ui` should launch Kiwi Control, bring it forward on macOS, and load the current repo automatically. Do not teach manual repo pasting as the normal desktop path.

Do not lead end users to contributor scripts such as `scripts/install-global.sh`.

Installed-user `kc ui` should now prefer:

1. explicit desktop launcher override env vars
2. the install receipt written by the installed app
3. normal installed-app OS locations
4. platform fallback launcher

Source bundle preference is now a developer-mode behavior, not the default for installed-user flows.

The public install and docs surface should be hosted on Cloudflare Pages and should point users to GitHub Releases for actual binaries and checksums.

## Distribution targets

Prepared channels:

- GitHub Releases
- Cloudflare Pages for landing/docs/download discovery
- Homebrew formula publication for installed CLI users
- winget manifest publication for installed CLI users
- macOS, Windows, and Linux desktop bundle publication

These channels are prepared for first beta publication, not yet live from this repo.

## Homebrew and winget readiness

Current templates:

- `packaging/homebrew/kiwi-control.rb.template`
- `packaging/winget/kiwi-control.installer.yaml.template`

They are beta-ready in the following sense:

- they point at Kiwi Control release artifact names
- they install `kiwi-control` and `kc` as the primary commands
- they preserve `shrey-junior` and `sj` as temporary beta compatibility aliases
- they assume the staged CLI bundle layout produced by `prepare-release-manifest`

They still need live release URLs and real SHA256 values at publish time.

## Public site and domain rollout

Recommended public-beta hosting split:

- Route 53 remains the domain registrar
- Cloudflare becomes the authoritative DNS provider
- Cloudflare Pages hosts:
  - landing page
  - install page
  - beta limitations page
  - docs and release discovery pages
- GitHub Releases remains the artifact backend

Recommended domain flow:

1. keep registration in Route 53
2. point nameservers to Cloudflare
3. attach apex and `www` to Cloudflare Pages
4. add redirects for `www`, docs, and install URLs
5. publish GitHub Release links and checksums through the Pages site

## Desktop packaging prerequisites

### macOS

- Xcode command line tools
- Rust/Cargo

### Windows

- Rust/Cargo
- MSVC build tools

The Windows beta desktop installer stays MSI-based in this slice. The highest-value change here is the bundled `kc` install and installed-user launch preference, not a bundler rewrite.

### Linux

- Rust/Cargo
- WebKitGTK and Tauri native dependencies

The CI workflow installs Linux prerequisites and Rust so tagged builds have a concrete desktop packaging path.

## Public launch support pages

The public beta release set should include:

- [docs/privacy-policy.md](/Volumes/shrey%20ssd/shrey-junior/docs/privacy-policy.md)
- [docs/terms-and-conditions.md](/Volumes/shrey%20ssd/shrey-junior/docs/terms-and-conditions.md)
- [docs/security-and-trust.md](/Volumes/shrey%20ssd/shrey-junior/docs/security-and-trust.md)

These pages should stay honest about the current beta:

- free and local-first now
- no hidden cloud requirement for core usage
- enterprise and managed distribution coming later

## Updater and desktop identity

The desktop product identity must stay visibly Kiwi Control across:

- Tauri product name
- window title
- bundle names
- icons
- updater metadata

Do not describe the desktop app as authoritative. It remains a thin repo-backed control surface over repo-local truth.

## Manual signing and trust work

Public release trust still requires manual setup for:

- macOS signing and notarization
- Windows signing
- Tauri updater signing

See [packaging/signing/README.md](/Volumes/shrey%20ssd/shrey-junior/packaging/signing/README.md).

## Release verification checklist

Before a public beta release:

1. Run the local verification commands.
2. Build the desktop bundle on each target platform.
3. Verify the installed-user flow:
   - installed desktop app preference
   - bundled `kc` install
   - first-run onboarding presence
4. Generate `dist/release/release-manifest.json`.
5. Verify `dist/release/cli-bundle` contains the public command wrappers and install helpers.
6. Publish SHA256 checksums for every artifact.
7. Confirm Homebrew and winget templates match the actual artifact names and command aliases.
8. State explicitly which bundles are signed and which are not.
8. Do not enable updater claims until updater signing inputs are active.
9. Verify the Cloudflare-hosted install/download pages point at the correct GitHub Release assets.

## Compatibility note

- internal packages remain `sj-core`, `sj-cli`, `sj-ui`
- repo-local schema and artifact IDs remain `shrey-junior/*`
- `sj` and `shrey-junior` still work temporarily
- `kiwi-control` and `kc` are the primary public commands

## Honesty rules

- do not claim signed desktop trust until platform signing was actually applied
- do not claim updater support until signed updater metadata is shipping
- do not claim Homebrew or winget availability until those channels are published
- do not imply repo-local schema renaming; beta compatibility still uses `shrey-junior/*`
- do not hide the Node 22+ requirement for the beta CLI bundle
