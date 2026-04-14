# Install Kiwi Control

Kiwi Control has three supported usage tracks:

- desktop users
- standalone CLI users
- source contributors

For the public beta, the public website is the primary install surface. The single-host public site publishes the actual release assets and metadata.

## Recommended path: desktop first

For most desktop users on macOS:

1. Open the installer-first website at [kiwi-control.kiwi-ai.in](https://kiwi-control.kiwi-ai.in/) or go directly to the public [downloads page](https://kiwi-control.kiwi-ai.in/downloads/).
2. Download the macOS desktop installer.
   - macOS: prefer `.pkg`; `.dmg` remains secondary for manual beta testing
3. Install Kiwi Control like a normal desktop app.
4. macOS: the pkg installer is the intended default path for install-time `kc` setup.
5. Windows: EXE/MSI desktop installers are not live yet. Use the Windows CLI bootstrap below if you only need `kc`.
6. If macOS installer-owned CLI setup does not complete, use the in-app terminal-command repair flow or the CLI bootstrap below.
7. Use onboarding to choose a repo and initialize it if needed.

### Desktop-only path

This is the default path Kiwi should optimize for:

1. install the desktop app
2. open the app
3. choose a repo
4. initialize the repo if Kiwi asks
5. start working

You do not need `kc` for basic desktop usage.

For public downloads, trust status is release-specific. Public hosting makes the artifacts reachable, not trusted. The release notes, `SHA256SUMS.txt`, and release manifest say whether the macOS DMG was signed/notarized and whether the Windows installer was signed on a Windows runner.

### Desktop + CLI path

Desktop installs aim to make `kc` straightforward without manual PATH editing:

1. macOS: the pkg installer should install the app and make `kc` available during install.
2. Windows: EXE/MSI desktop installers are not live yet, so the public wrapper installs the CLI only.
3. if macOS installer-owned setup does not complete, use the in-app repair action
4. if Windows desktop setup is blocked later, use the CLI bootstrap below
5. keep using the same repo from desktop or CLI interchangeably after setup succeeds

### Default terminal commands

Kiwi Control keeps the desktop app usable even if terminal command setup cannot complete, but the post-install behavior is intentionally platform-specific:

- Windows: the NSIS setup EXE is not published yet; keep Windows desktop availability unavailable until a real Windows artifact exists
- Windows MSI: keep it unavailable until it has the same default-CLI proof as the setup EXE
- macOS: the pkg installer is the intended default path and should place `kc` into `/usr/local/bin`
- macOS fallback: if pkg install-time setup is not reliable on that machine, use the one-click enable flow in the app
- Kiwi verifies whether `kc` is callable from a fresh shell/process and reports the exact result

If verification succeeds but your current terminal is still stale, Kiwi will tell you to open a new terminal window.

## Standalone CLI users

### Prerequisites

- Node.js 22 or newer when you are installing the standalone beta CLI bundle yourself

The beta CLI bundle is still Node-backed. That is an intentional beta constraint, not a hidden runtime dependency.
Homebrew tap files are scaffolded for maintainers but not published as a public tap yet. Winget is not published for this beta. Use the published wrapper installers or CLI bundle links on the public site instead.

### Quick CLI install from public wrappers

These wrapper installers install the standalone CLI bundle only. They install `kiwi-control` and `kc`, verify `kc --help`, and do not install the desktop app unless you explicitly pass the desktop option and a real desktop artifact exists for that OS.

On macOS or Linux:

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash
```

On Windows:

```powershell
irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex
```

Optional macOS desktop opt-in, only when the macOS pkg URL is published:

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash -s -- --desktop
```

Optional Windows desktop opt-in remains honest: because Windows EXE/MSI are not live yet, this prints that the Windows desktop installer is not published yet and still leaves a working CLI install.

After install, the public commands are:

- `kiwi-control`
- `kc`

The standalone CLI bundle installs only those terminal commands. It does not install Kiwi Control Desktop. If Kiwi Control Desktop is already installed, `kc ui` can launch or attach to it.

Fresh terminal verification:

```bash
command -v kc
kc --help
```

On Windows PowerShell:

```powershell
Get-Command kc
kc --help
```

### Manual CLI bundle path

Use the public [downloads page](https://kiwi-control.kiwi-ai.in/downloads/) if you need to inspect or manually extract a CLI bundle. The wrapper path above is preferred because it chooses the correct bundle, installs `kc`, and verifies `kc --help`.

### First CLI flow

```bash
cd /path/to/repo
kc init
kc status
kc check
kc guide
```

## Source contributors

### Prerequisites

- Node.js 22+
- npm 10+
- Rust/Cargo for desktop builds
- platform-native desktop toolchain

Platform notes:

- macOS: Xcode command line tools
- Windows: Visual Studio C++ build tools
- Linux: WebKitGTK and related Tauri native dependencies

### Exact contributor commands

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
npm run ui:dev
```

Desktop production build:

```bash
npm run ui:desktop:build
```

## macOS external volume caveat

On some external macOS volumes, AppleDouble `._*` files can appear inside the working tree or `.git` and break Git pack indexes.

If that happens, run:

```bash
npm run clean:macos-sidecars
```

If Git pack errors continue, move the repo to internal storage before retrying heavy Git operations.

## Compatibility note

This beta keeps public naming stable while internal implementation names remain:

- public commands: `kiwi-control`, `kc`
- internal packages: `sj-core`, `sj-cli`, `sj-ui`

## Related docs

- [Beta limitations](./beta-limitations.md)
- [Release packaging](./release-packaging.md)
- [Support](../SUPPORT.md)
