# Install Kiwi Control

This guide is the source of truth for installing Kiwi Control and getting to the first useful commands without guessing.

The fastest path depends on what you want:

- desktop app on macOS or Windows: use the published desktop installer first
- CLI only on macOS, Linux, or Windows: use the wrapper install script
- source contributor: build from this repo

## Quickstart

### Fastest desktop path

1. Open [kiwi-control.kiwi-ai.in/downloads](https://kiwi-control.kiwi-ai.in/downloads/).
2. Install the desktop app for your OS.
3. Verify `kc` from a fresh shell.
4. Open or clone a repo.
5. Run the first repo commands:

```bash
kc init
kc status
kc guide
kc graph build
kc pack status
kc review
kc ui
```

### Fastest CLI-only path

On macOS or Linux:

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash
```

On Windows PowerShell:

```powershell
irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex
```

Then verify:

```bash
kiwi-control --help
kc --help
command -v kc
```

On Windows PowerShell:

```powershell
kiwi-control --help
kc --help
Get-Command kc
```

## Choose your install path

## Desktop-first install

The desktop app is the recommended path when a desktop artifact exists for your OS.

### macOS

Use the `.pkg` installer first. The `.dmg` is a secondary manual beta path.

What the `.pkg` path is intended to do:

- install Kiwi Control Desktop
- make `kc` available during install
- let you keep using the desktop app even if you never touch the CLI again

Verify after install from a new terminal window:

```bash
command -v kc
kc --help
kc ui
```

### Windows

Use the setup EXE first. The MSI is a secondary manual path for the current beta.

What the setup EXE path is intended to do:

- install Kiwi Control Desktop
- make `kc` available for a fresh PowerShell or cmd session
- keep MSI available as the secondary path while signing proof remains incomplete

Verify after install from a fresh PowerShell window:

```powershell
Get-Command kc
kc --help
kc ui
```

### Linux

The public beta does not currently publish a Linux desktop installer. Use the CLI-only path below.

## CLI-only install

The wrapper installers install the standalone CLI bundle only. They install:

- `kiwi-control`
- `kc`

They do not install the desktop app unless you explicitly request desktop install and a real desktop artifact exists for that OS.

### Prerequisites for the standalone CLI bundle

- Node.js `22+`
- macOS or Linux for `install.sh`
- Windows PowerShell for `install.ps1`

The standalone beta CLI bundle is still Node-backed. That requirement is real and should be called out plainly.

### macOS or Linux

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash
```

Optional macOS desktop opt-in through the wrapper, only when the macOS pkg URL is published:

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash -s -- --desktop
```

### Windows PowerShell

```powershell
irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex
```

Optional desktop opt-in through the PowerShell wrapper:

```powershell
& ([scriptblock]::Create((irm https://kiwi-control.kiwi-ai.in/install.ps1))) -Desktop
```

## Verify that install worked

## Verify the commands

On macOS or Linux:

```bash
kiwi-control --help
kc --help
command -v kc
```

On Windows PowerShell:

```powershell
kiwi-control --help
kc --help
Get-Command kc
```

## Verify the desktop bridge

If Kiwi Control Desktop is installed, this should launch or attach to it:

```bash
kc ui
```

On Windows PowerShell:

```powershell
kc ui
```

## First repo flow

## New repo or repo not initialized yet

```bash
cd /path/to/repo
kc init
kc status
kc guide
kc graph build
kc pack status
kc review
kc check
kc ui
```

## Existing initialized repo

```bash
cd /path/to/repo
kc status
kc guide
kc graph status
kc graph build
kc pack status
kc review
kc check
kc ui
```

## What those commands do

- `kc init`: create the repo-local Kiwi Control contract when the repo is not initialized yet
- `kc status`: show current repo state and readiness
- `kc guide`: show the next useful files, commands, and workflow hints
- `kc graph build`: refresh repo intelligence artifacts
- `kc pack status`: show the currently selected pack guidance
- `kc review`: build review-oriented guidance from the current repo state
- `kc check`: validate repo-local contract and workflow assumptions
- `kc ui`: open or attach the desktop app

For a broader command reference, see [docs/command-guide.md](./command-guide.md).

## Common install and first-run problems

## `kc` command not found

What to do:

1. Open a fresh terminal or fresh PowerShell window.
2. Run the verify commands again.
3. If the desktop app is installed but `kc` is still missing, use the CLI-only wrapper install.

macOS or Linux:

```bash
curl -fsSL https://kiwi-control.kiwi-ai.in/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://kiwi-control.kiwi-ai.in/install.ps1 | iex
```

## Desktop app installed but CLI missing

The desktop app and CLI are related but not identical install surfaces.

- desktop install is the recommended path for app users
- the wrapper installers are the clean fallback when terminal command setup did not complete

If the app is already installed, `kc ui` can still be useful after the CLI wrapper finishes.

## Windows PATH not refreshed yet

If `kc` is not found right after install:

1. close the current PowerShell or cmd window
2. open a fresh PowerShell window
3. run:

```powershell
Get-Command kc
kc --help
```

If it still fails, run the PowerShell wrapper install again.

## macOS first-open trust warning

This beta may still show an unsigned or not-yet-notarized trust warning on macOS.

If Finder blocks the `.pkg`:

1. locate the downloaded `.pkg` in Finder
2. Control-click it
3. choose `Open`
4. if needed, go to `System Settings > Privacy & Security` and choose `Open Anyway`

That is a beta trust caveat, not proof that the installer is fully trusted.

## Difference between `kiwi-control` and `kc`

They point at the same CLI.

- `kiwi-control` is the full command name
- `kc` is the short daily-use alias

## How to use Kiwi with Claude Code, Codex, or Cursor

The practical pattern is:

1. install Kiwi Control
2. run the first repo commands
3. give your coding agent the repo after Kiwi has already surfaced context and workflow state

Good first commands before deeper agent work:

```bash
kc status --json
kc guide --json
kc graph build --json
kc pack status --json
kc review --json
```

## Unsupported or not-yet-live install paths

These are not public install paths right now:

- Homebrew install
- winget install
- Linux desktop installer

Do not document them as live until they are actually published.

## Related docs

- [Command guide](./command-guide.md)
- [Beta limitations](./beta-limitations.md)
- [Release packaging](./release-packaging.md)
- [Support](../SUPPORT.md)
