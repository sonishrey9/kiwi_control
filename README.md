# Kiwi Control

Kiwi Control is a repo-local control plane for coding agents. It gives you one installable CLI, one desktop app, and one repo-backed operating model without moving authority out of the repository. The backend stays deterministic, the CLI stays practical, and the desktop app stays a thin shell over repo state instead of becoming its own hidden runtime.

![Overview screenshot placeholder](./docs/assets/screenshot-overview-placeholder.png)
![Graph screenshot placeholder](./docs/assets/screenshot-graph-placeholder.png)

## Why Kiwi

Most agent tooling is either editor-native and opaque, or automated and destructive. Kiwi takes a different path:

- repo-local artifacts stay authoritative
- machine-global setup is an accelerator, not a dependency
- the control plane is explicit, inspectable, and versionable
- the desktop app mirrors repo truth instead of inventing a parallel truth source
- generic repositories stay quiet until you opt in

## Features

- Repo-first execution planning with explicit prepare, validate, checkpoint, and handoff flows
- Bounded context selection with context trees, dependency hints, and confidence signals
- Repo-local memory, continuity, and eval artifacts under `.agent/`
- Machine advisory for toolchain, MCP, usage, and config health
- CLI surface for day-to-day work: `guide`, `next`, `retry`, `resume`, `status`, `trace`, `validate`, `run --auto`
- Desktop control surface with sidebar navigation, graph view, inspector, token visibility, and interactive actions
- Cross-platform desktop packaging via Tauri for macOS and Windows, plus Linux build support

## Quickstart

### Install

From a release bundle:

```bash
./install.sh
```

After install:

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
kc guide
```

### Continue work

```bash
kc next
kc validate
kc checkpoint "ready for qa"
kc handoff --to qa-specialist
```

### Open the desktop app

```bash
cd /path/to/repo
kc ui
```

If the desktop bundle is installed, Kiwi Control opens it and loads the current repo automatically.

## Desktop usage

The desktop shell gives you:

- Overview: repo health, task summary, execution plan, next actions
- Context: live context tree, file analysis, context trace
- Graph: repo mind map from current context tree
- Tokens: estimated and measured token usage
- Feedback: adaptive file preference and task reuse
- Specialists / MCPs / System / Validation / Machine: operator-level visibility and actions

## Core commands

```bash
kc guide --target /path/to/repo
kc next --target /path/to/repo
kc retry --target /path/to/repo
kc resume --target /path/to/repo
kc status --target /path/to/repo
kc trace --target /path/to/repo
kc validate --target /path/to/repo
kc run --auto "stabilize auth flow" --target /path/to/repo
```

Use `--json` on operator-facing commands when you need machine-readable output.

## Architecture

Kiwi Control is a 3-layer monorepo:

- `packages/sj-core` — repo-local engine, planning, selection, eval, validation, state aggregation
- `packages/sj-cli` — human and machine-friendly command surface over `sj-core`
- `apps/sj-ui` — Tauri desktop shell that reads repo state and invokes allowlisted command flows

```text
repo + .agent artifacts
        |
        v
    sj-core
        |
   +----+----+
   |         |
   v         v
 sj-cli    ui-bridge
   |         |
   +----+----+
        |
        v
    Tauri desktop
```

Read the full contributor-oriented design in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Developer quickstart

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
npm run ui:dev
```

Desktop build:

```bash
npm run ui:desktop:build
```

## Open-source status

What is solid today:

- repo-local backend and CLI
- desktop shell with working repo-state hydration and command bridge
- CI-ready build and test flow
- machine advisory and desktop operator views

What is still actively improving:

- UI modularization and tests
- desktop interaction ergonomics
- CLI output consistency
- packaging polish and signing

## Contributing

Start with [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

See [LICENSE.md](./LICENSE.md).
