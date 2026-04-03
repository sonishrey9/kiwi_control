# Shrey Junior

Shrey Junior is a local-first, repo-first control plane for coding agents.

It helps developers keep repo-local artifacts as the portable source of truth while still working across different runtimes, tools, and local setups. Machine-global files are accelerators only. CI is the hard enforcement layer.

## Product thesis

Shrey Junior is not a generic AI wrapper.

It is a repo-first control plane for coding agents:

- repo-local artifacts are authoritative
- machine-global state is optional convenience
- MCP and tool support are not symmetric across runtimes
- Copilot is suggestion-oriented, not a strict orchestration runtime
- destructive automation is out of scope
- auto-commit, auto-push, and destructive cleanup are out of scope
- generic repos stay quiet by default

## Package architecture

The product is now split into three installable layers:

- `sj-core`
  Platform-neutral business logic, artifact schemas, routing, checkpoints, handoffs, repo memory, validation, and repo contract generation.
- `sj-cli`
  Stable command-line surface over `sj-core` with human-readable and JSON output paths.
- `sj-ui`
  A local desktop shell with a Tauri-based packaging scaffold. It is designed to read repo-local state through a thin local bridge rather than inventing hidden authoritative state.

Canonical authority in this repo still lives only in:

- `configs/`
- `prompts/`
- `templates/`

Generated repo artifacts remain outputs, not authority.

## What works today

- repo initialization, standardization, sync, packets, dispatch, collect, reconcile, checkpoints, handoffs, and push-readiness checks
- canonical specialist registry used across routing, continuity, docs, and CLI output
- repo-local memory bank under `.agent/memory/`
- curated MCP pack guidance with explicit realism notes
- workspace builds for `sj-core`, `sj-cli`, and `sj-ui`
- a desktop UI shell and Tauri packaging scaffold
- source and smoke-test coverage for the repo-first operating model

## What is intentionally honest

- MCP packs are guidance, not guaranteed runtime capability
- desktop packaging still needs platform signing and updater keys before public release
- Homebrew and winget scaffolding is included, but live publication is still a release step
- the UI shell exists now, but the local runtime bridge should keep evolving until it is fully release-ready

## Install and run

### From source

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
```

CLI examples:

```bash
node packages/sj-cli/dist/cli.js check --target "/path/to/repo"
node packages/sj-cli/dist/cli.js status --target "/path/to/repo"
node packages/sj-cli/dist/cli.js specialists --json
node packages/sj-cli/dist/cli.js ui --target "/path/to/repo" --json
```

Desktop shell from source:

```bash
npm run ui:dev
```

See [docs/install.md](docs/install.md) for the local install and packaging channels plan.

## Command surface

Core CLI commands:

- `bootstrap`
- `standardize`
- `audit`
- `check`
- `init`
- `sync`
- `run`
- `fanout`
- `checkpoint`
- `handoff`
- `status`
- `specialists`
- `ui`
- `push-check`
- `dispatch`
- `collect`
- `reconcile`

Use `--json` on `check`, `status`, `specialists`, and `ui` when a machine-readable payload is more useful than plain text.

## Repo-local continuity

Repo continuity is first-class and stays local:

- `.agent/state/current-phase.json`
- `.agent/state/active-role-hints.json`
- `.agent/state/checkpoints/latest.json`
- `.agent/state/handoff/`
- `.agent/memory/repo-facts.json`
- `.agent/memory/current-focus.json`
- `.agent/memory/open-risks.json`

The compact memory bank remains the portable continuity layer. MCP memory and machine-global memory are accelerators only.

## MCP packs

Curated packs included today:

- `core-pack`
- `research-pack`
- `web-qa-pack`
- `aws-pack`
- `ios-pack`
- `android-pack`

These packs shape routing and guidance. They do not promise universal tool parity.

## Public beta readiness

The repo now contains:

- workspace package boundaries
- Tauri desktop scaffolding
- release manifest generation
- CI workflow scaffolding
- Homebrew and winget templates
- issue templates and community docs
- roadmap and contribution guidance

See:

- [docs/package-architecture.md](docs/package-architecture.md)
- [docs/release-packaging.md](docs/release-packaging.md)
- [ROADMAP.md](ROADMAP.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SUPPORT.md](SUPPORT.md)

## Non-goals

- replacing Codex, Claude Code, Cursor, or Copilot runtimes
- claiming universal MCP parity
- moving truth out of the repo
- hidden cloud dependence for core operation
- destructive automation
- auto-commit or auto-push
- turning generic repos into noisy agent control planes
