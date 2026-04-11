# Install Kiwi Control

Kiwi Control has three supported usage tracks:

- desktop users
- standalone CLI users
- source contributors

For the public beta, Cloudflare-hosted downloads are the primary install surface. GitHub Releases remains the source for release notes and release history.

## Recommended path: desktop first

For most users on macOS and Windows:

1. Open the installer-first website at [kiwi-control.kiwi-ai.in](https://kiwi-control.kiwi-ai.in/) or go directly to the public [downloads page](https://kiwi-control.kiwi-ai.in/downloads/).
2. Download the desktop installer for your platform.
   - macOS: `.dmg`
   - Windows: `-setup.exe` or `.msi`
3. Install Kiwi Control like a normal desktop app.
4. Launch Kiwi Control once.
5. Use onboarding to choose a repo and initialize it if needed.
6. Enable terminal commands later only if you want the power-user terminal path too.

### Desktop-only path

This is the default path Kiwi should optimize for:

1. install the desktop app
2. open the app
3. choose a repo
4. initialize the repo if Kiwi asks
5. start working

You do not need `kc` for basic desktop usage.

For public downloads, trust status is release-specific. Cloudflare hosting makes the artifacts public, not trusted. The release notes, `SHA256SUMS.txt`, and release manifest say whether the macOS DMG was signed/notarized and whether the Windows installer was signed on a Windows runner.

### Desktop + CLI path

Install `kc` only if you want the same repo flow from Terminal too:

1. install the desktop app
2. open the app once
3. use onboarding to enable terminal commands only if you want the terminal path
4. keep using the same repo from desktop or CLI interchangeably

### Optional terminal commands

Kiwi Control keeps the desktop app usable without any terminal setup.

If you explicitly choose `Enable terminal commands (kc)` from the app:

- macOS: Kiwi installs shared command wrappers for `/usr/local/bin` after explicit approval
- Windows: Kiwi installs shared command wrappers and updates machine PATH after explicit approval
- Kiwi then verifies whether `kc` is callable from a fresh shell/process and reports the exact result

If verification succeeds but your current terminal is still stale, Kiwi will tell you to open a new terminal window.

## Standalone CLI users

### Prerequisites

- Node.js 22 or newer when you are installing the standalone beta CLI bundle yourself

The beta CLI bundle is still Node-backed. That is an intentional beta constraint, not a hidden runtime dependency.

### Install from public downloads

1. Download the matching Kiwi Control CLI bundle from the public [downloads page](https://kiwi-control.kiwi-ai.in/downloads/) or the corresponding GitHub release page.
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

After install, the public commands are:

- `kiwi-control`
- `kc`

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
