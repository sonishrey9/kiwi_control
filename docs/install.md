# Install Kiwi Control

Kiwi Control has three supported usage tracks:

- desktop users
- standalone CLI users
- source contributors

For the public beta, the public website is the primary install surface. The single-host public site publishes the actual release assets and metadata.

## Recommended path: desktop first

For most users on macOS and Windows:

1. Open the installer-first website at [kiwi-control.kiwi-ai.in](https://kiwi-control.kiwi-ai.in/) or go directly to the public [downloads page](https://kiwi-control.kiwi-ai.in/downloads/).
2. Download the desktop installer for your platform.
   - macOS: prefer `.pkg`; `.dmg` remains secondary for manual beta testing
   - Windows: prefer `-setup.exe`; `.msi` remains secondary until it has the same CLI proof bar
3. Install Kiwi Control like a normal desktop app.
4. macOS: the pkg installer is the intended default path for install-time `kc` setup.
5. Windows: the setup EXE is the intended default path for installer-time `kc` setup, but public automatic-readiness claims stay gated on real Windows-host proof.
6. If macOS installer-owned CLI setup does not complete, use the obvious in-app terminal-command repair flow instead of editing PATH manually.
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
2. Windows: the setup EXE is the intended installer-time `kc` path for normal users, but proof is still pending on a real Windows host.
3. if macOS installer-owned setup does not complete, use the in-app repair action
4. if Windows setup is blocked later, use the fallback manual CLI path below
5. keep using the same repo from desktop or CLI interchangeably after setup succeeds

### Default terminal commands

Kiwi Control keeps the desktop app usable even if terminal command setup cannot complete, but the post-install behavior is intentionally platform-specific:

- Windows: the NSIS setup EXE is the intended default Windows path and should auto-enable `kc` during install; keep the public claim gated on real Windows-host proof
- Windows MSI: treat it as a secondary packaging path until it has the same default-CLI proof as the setup EXE
- macOS: the pkg installer is the intended default path and should place `kc` into `/usr/local/bin`
- macOS fallback: if pkg install-time setup is not reliable on that machine, use the one-click enable flow in the app
- Kiwi verifies whether `kc` is callable from a fresh shell/process and reports the exact result

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

### Windows fallback CLI path

Fallback only. Keep the desktop installer as the primary path. Use this only if the Windows installer flow is blocked and only after the Windows CLI bundle is published on the public site.

PowerShell metadata-driven fallback:

```powershell
$meta = Invoke-RestMethod "https://kiwi-control.kiwi-ai.in/data/latest-release.json"; if (-not $meta.publicReleaseReady -or -not $meta.artifacts.cliWindows.latestUrl) { throw "Windows CLI bundle is not published yet. Use the desktop installer path for now." }; $zip = Join-Path $env:TEMP "kiwi-control-cli.zip"; $dir = Join-Path $env:TEMP "kiwi-control-cli"; Invoke-WebRequest $meta.artifacts.cliWindows.latestUrl -OutFile $zip; Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue; Expand-Archive $zip -DestinationPath $dir -Force; & (Join-Path $dir "install.ps1"); Get-Command kc; kc --help
```

`curl.exe` variant:

```powershell
$meta = Invoke-RestMethod "https://kiwi-control.kiwi-ai.in/data/latest-release.json"; if (-not $meta.publicReleaseReady -or -not $meta.artifacts.cliWindows.latestUrl) { throw "Windows CLI bundle is not published yet. Use the desktop installer path for now." }; $zip = Join-Path $env:TEMP "kiwi-control-cli.zip"; $dir = Join-Path $env:TEMP "kiwi-control-cli"; curl.exe -L $meta.artifacts.cliWindows.latestUrl -o $zip; Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue; Expand-Archive $zip -DestinationPath $dir -Force; & (Join-Path $dir "install.ps1"); Get-Command kc; kc --help
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
