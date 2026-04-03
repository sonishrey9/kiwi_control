# Install Kiwi Control

Kiwi Control now has three explicit usage tracks:

- installed CLI users
- installed desktop users
- source contributors

For `0.2.0-beta.1`, GitHub Releases is the primary public install path. Homebrew and winget templates are ready, but those channels should not be treated as live until they are actually published.

## Installed CLI users

### Prerequisites

- Node.js 22 or newer

The beta CLI bundle is still Node-backed. That is an honest implementation detail, not a hidden runtime dependency.

### Install from GitHub Releases

1. Download the matching Kiwi Control CLI bundle from the GitHub Release.
2. Extract it.
3. Run the included installer.

On macOS or Linux:

```bash
./install.sh
```

On Windows:

```powershell
.\install.ps1
```

If you are installing from a source checkout before using a GitHub Release, run:

```bash
./install.sh
```

After install, the public commands are:

- `kiwi-control`
- `kc`

Temporary beta compatibility aliases are also installed:

- `shrey-junior`
- `sj`

### First installed CLI flow

```bash
cd /path/to/repo
kiwi-control init
kiwi-control status
kiwi-control check
kiwi-control specialists
kiwi-control checkpoint "first local proof"
kiwi-control handoff --to qa-specialist
kiwi-control ui
```

If you want machine-readable output:

```bash
kiwi-control ui --json
```

## Installed desktop users

### Prerequisites

- the matching Kiwi Control desktop bundle for your platform

### Install the desktop app

Download the desktop bundle from the same GitHub Release as your CLI install:

- macOS: Kiwi Control `.app` archive
- Windows: Kiwi Control MSI
- Linux: Kiwi Control AppImage bundle

After install, you can:

- open `Kiwi Control` from your OS application launcher
- `cd /path/to/repo && kiwi-control ui`

`kiwi-control ui` launches the desktop app when the desktop bundle is installed or otherwise CLI-launchable, brings it forward on macOS, and loads the repo you are standing in automatically. Manual repo switching stays available inside the app only when you want a different folder.

If the desktop app is not available yet, the command fails clearly and tells you the next exact step.

If your platform install does not register a CLI-launchable desktop app, set `KIWI_CONTROL_DESKTOP` to the installed launcher path so `kiwi-control ui` has a deterministic local desktop target.

### What the desktop app shows

- Repo Overview
- Continuity
- Memory Bank
- Specialists
- MCP Packs
- Validation

The desktop app is a local control surface only. Repo-local artifacts under `.agent/` remain the source of truth.

## Source contributors

### Prerequisites

- Node.js 22
- npm 10+

### Desktop build prerequisites

- Rust and Cargo
- platform-native desktop toolchain

Platform notes:

- macOS: Xcode command line tools
- Windows: Visual Studio C++ build tools
- Linux: WebKitGTK and related Tauri native dependencies

### Exact contributor commands

Install dependencies:

```bash
npm install
```

Build all packages:

```bash
npm run build
```

Run the CLI from source:

```bash
npm run cli -- status
```

Run the desktop app from source:

```bash
npm run ui:dev
```

Build desktop web assets:

```bash
npm run ui:build
```

Build desktop artifacts locally:

```bash
npm run ui:desktop:build
```

Verify the repo before release work:

```bash
npm test
bash scripts/smoke-test.sh
```

## Compatibility note

This beta keeps backward compatibility in place while moving the visible product to Kiwi Control:

- internal packages remain `sj-core`, `sj-cli`, and `sj-ui`
- repo-local schema and artifact IDs remain `shrey-junior/*`
- `sj` and `shrey-junior` still work temporarily
- `kiwi-control` and `kc` are the primary public commands

## Distribution status

Prepared but not yet published:

- GitHub Releases
- Homebrew for installed CLI users
- winget for installed CLI users
- macOS, Windows, and Linux desktop bundles via Tauri

See [docs/release-packaging.md](/Volumes/shrey%20ssd/shrey-junior/docs/release-packaging.md) for release artifact details and [packaging/signing/README.md](/Volumes/shrey%20ssd/shrey-junior/packaging/signing/README.md) for manual trust steps.
