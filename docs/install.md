# Install Kiwi Control

Kiwi Control now has three explicit usage tracks:

- installed desktop users
- installed CLI users
- source contributors

For `0.2.0-beta.1`, GitHub Releases is the primary public install path. Homebrew and winget templates are prepared, but those channels should not be treated as live until they are actually published.

Public beta install priority:

1. Windows desktop + `kc`
2. macOS desktop + `kc`
3. Linux CLI and contributor flows

## Recommended normal-user install

For normal users on Windows and macOS:

1. Download the desktop installer from the GitHub Release.
2. Install Kiwi Control like a normal desktop app.
3. Launch Kiwi Control once.
4. Use the onboarding flow to:
   - install `kc`
   - choose the repo you want to open
   - initialize repo control if needed

The installed desktop app now writes a local install receipt on first launch. After that, `kc ui` prefers the installed app by default instead of a source bundle.

## Installed CLI users

### Prerequisites

- Node.js 22 or newer when you are installing the standalone beta CLI bundle yourself

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

Windows and macOS are the normal-user beta install targets. Linux desktop bundles remain evaluation-only for now.

After install, you can:

- open `Kiwi Control` from your OS application launcher
- use the onboarding flow to install `kc`, choose a repo, and initialize it if needed
- `cd /path/to/repo && kiwi-control ui`

`kiwi-control ui` now prefers the installed desktop app in the normal installed-user flow, brings it forward on macOS, and loads the repo you are standing in automatically.

If the desktop app is not available yet, the command fails clearly and tells you the next exact step.

Power-user overrides still exist:

- `KIWI_CONTROL_DESKTOP` / `SHREY_JUNIOR_DESKTOP` to force an exact launcher path
- `KIWI_CONTROL_DESKTOP_PREFERENCE=installed|source` to force installed-user or developer-source launch behavior

### What first launch now does

The first-run flow is intentionally small:

- explains that Kiwi is a repo-local control surface
- shows desktop status, CLI status, and repo status
- lets you install `kc` without a manual terminal installer step
- lets you choose a repo folder from a native folder picker
- lets you initialize repo control when the selected repo is not initialized

On macOS, the in-app CLI install writes wrappers to `~/.local/bin` and updates your shell profile for future terminals.

On Windows, the in-app CLI install writes wrappers to `%USERPROFILE%\\.kiwi-control\\bin` and updates the user PATH for future terminals.

## Public beta support note

See [beta limitations](./beta-limitations.md) before treating the desktop app as a fully trusted general-availability install.

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

Contributor caveat:

- On some external macOS volumes, AppleDouble `._*` files can appear inside `.git` and break large clones or Git pack indexes. If that happens, move the repo to internal storage or clean the `._*` files inside `.git` before continuing.

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
- repo-local schema and artifact IDs remain backward compatible during beta
- `kiwi-control` and `kc` are the primary public commands

## Distribution status

Prepared but not yet published:

- GitHub Releases
- Homebrew for standalone CLI users
- winget for standalone CLI users
- macOS, Windows, and Linux desktop bundles via Tauri

See [release packaging](./release-packaging.md) for artifact details, [beta limitations](./beta-limitations.md) for beta caveats, and [packaging/signing/README.md](../packaging/signing/README.md) for manual trust steps.
