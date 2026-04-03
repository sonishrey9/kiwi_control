# Kiwi Control

Kiwi Control is a local-first, repo-first control plane for coding agents.

It gives developers one installable CLI and desktop control surface while keeping the real authority inside the repo. Repo-local artifacts are the portable source of truth. Machine-global files are accelerators only. CI remains the hard enforcement layer.

Public beta positioning:

- Kiwi Control is free and local-first for the first public beta.
- Core usage does not depend on a cloud backend.
- Enterprise distribution, team controls, and managed support are coming later, not hidden inside the beta.

## Product thesis

Kiwi Control is not a generic AI tooling wrapper.

It is a repo-first control plane for coding agents:

- repo-local artifacts are authoritative
- machine-global state is optional convenience
- MCP and tool support are not symmetric across runtimes
- Copilot is suggestion-oriented, not a strict orchestration runtime
- destructive automation is out of scope
- auto-commit, auto-push, and destructive cleanup are out of scope
- generic repos stay quiet by default

## Package architecture

The product is split into three installable layers:

- `sj-core`
  Platform-neutral business logic, schemas, routing, checkpoints, handoffs, repo memory, validation, recommendations, and repo contract generation.
- `sj-cli`
  Stable command-line surface over `sj-core` with human-readable and JSON output.
- `sj-ui`
  A local Tauri desktop shell that reads repo-local state through a thin local bridge.

Canonical authority in this repo still lives only in:

- `configs/`
- `prompts/`
- `templates/`

Generated repo artifacts remain outputs, not authority.

## Visible rebrand, compatible beta contract

This beta uses a visible rebrand only:

- the product name is `Kiwi Control`
- the primary CLI command is `kiwi-control`
- the short alias is `kc`
- compatibility aliases `shrey-junior` and `sj` still work
- repo-local schema and artifact IDs remain `shrey-junior/*` during `0.2.0-beta.1`
- package boundaries stay `sj-core`, `sj-cli`, and `sj-ui`

## Quickstart

### Install the CLI

For `0.2.0-beta.1`, GitHub Releases is the primary install path.

1. Download the matching Kiwi Control CLI bundle from GitHub Releases.
2. Extract it.
3. Run the included installer:

```bash
./install.sh
```

On Windows:

```powershell
.\install.ps1
```

If you are dogfooding directly from this source checkout before using a GitHub Release, run:

```bash
./install.sh
```

The beta CLI bundle stays Node-backed. Install Node.js 22 or newer before running the installed commands.

After install, use:

```bash
kiwi-control --help
kc --help
```

### First repo workflow

```bash
cd /path/to/repo
kc init
kc status
kc check
```

If the repo is generic and not initialized yet, Kiwi Control stays quiet until you opt in.

### Continue work with checkpoints and handoffs

```bash
kc checkpoint "finish contract pass"
kc handoff --to qa-specialist
```

Repo-local continuity stays under:

- `.agent/state/`
- `.agent/memory/`
- native repo instruction surfaces

### Open the desktop app

Install the matching Kiwi Control desktop bundle from the same GitHub Release, then either open the app from your OS launcher or run:

```bash
cd /path/to/repo
kiwi-control ui
```

`kiwi-control ui` launches Kiwi Control, brings the desktop app forward on macOS, and loads the current repo automatically. Manual repo switching stays available inside the app only when you want a different folder.

The desktop app stays repo-backed and non-authoritative. It mirrors:

- Repo Overview
- Continuity
- Memory Bank
- Specialists
- MCP Packs
- Validation

## How to use Kiwi Control

### Installed CLI users

```bash
cd /path/to/repo
kiwi-control init
kiwi-control status
kiwi-control check
kiwi-control specialists
kiwi-control checkpoint "beta handoff ready"
kiwi-control handoff --to qa-specialist
```

Use `kc` when you want the short alias:

```bash
kc status
```

### Installed desktop users

```bash
cd /path/to/repo
kiwi-control ui
```

If the desktop bundle is installed and CLI-launchable, Kiwi Control opens it directly and loads the repo you are standing in. If it is not installed yet, the CLI tells you the next exact step instead of pretending the desktop path exists.

### Source contributors

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
npm run cli -- status
npm run ui:dev
```

Contributor-only `npm run ...` commands stay documented, but they are not the primary end-user story.

## Public command surface

Core public commands:

- `kiwi-control init`
- `kiwi-control status`
- `kiwi-control check`
- `kiwi-control specialists`
- `kiwi-control checkpoint`
- `kiwi-control handoff`
- `kiwi-control ui`

Use `--json` on `status`, `check`, `specialists`, and `ui` when machine-readable output is more useful than plain text.

Advanced control-plane commands still exist, but they are intentionally secondary to the core public workflow. Use `kiwi-control --help` for the full surface.

## What works now

- installed CLI naming with `kiwi-control` as the primary command and `kc` as the short alias
- source contributor workflow with `npm run cli -- ...` and `npm run ui:dev`
- repo initialization, status, validation, checkpoints, handoffs, routing, and continuity
- canonical specialist registry across CLI, UI, docs, and routing
- repo-local memory bank under `.agent/memory/`
- curated MCP pack guidance with explicit realism notes
- release manifest generation plus a staged CLI bundle with public install wrappers
- Homebrew and winget templates aligned with Kiwi Control artifact names

## What is still manual before a public release

- publishing the GitHub Release assets
- macOS signing and notarization
- Windows signing
- Tauri updater signing and activation
- Homebrew publication
- winget publication

See:

- [docs/install.md](/Volumes/shrey%20ssd/shrey-junior/docs/install.md)
- [docs/package-architecture.md](/Volumes/shrey%20ssd/shrey-junior/docs/package-architecture.md)
- [docs/release-packaging.md](/Volumes/shrey%20ssd/shrey-junior/docs/release-packaging.md)
- [docs/beta-readiness-checklist.md](/Volumes/shrey%20ssd/shrey-junior/docs/beta-readiness-checklist.md)
- [docs/privacy-policy.md](/Volumes/shrey%20ssd/shrey-junior/docs/privacy-policy.md)
- [docs/terms-and-conditions.md](/Volumes/shrey%20ssd/shrey-junior/docs/terms-and-conditions.md)
- [docs/security-and-trust.md](/Volumes/shrey%20ssd/shrey-junior/docs/security-and-trust.md)
- [packaging/signing/README.md](/Volumes/shrey%20ssd/shrey-junior/packaging/signing/README.md)

## Non-goals

- replacing Codex, Claude Code, Cursor, or Copilot runtimes
- claiming universal MCP parity
- moving truth out of the repo
- hidden cloud dependence for core operation
- destructive automation
- auto-commit or auto-push
- turning generic repos into noisy agent control planes
