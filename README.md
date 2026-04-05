# Kiwi Control

Kiwi Control is a repo-local control plane for coding agents. It keeps authority inside the repository, exposes a practical CLI for day-to-day work, and ships a Tauri desktop shell for visibility, interaction, and review.

![Kiwi Control Overview](./docs/assets/overview-placeholder.png)
![Kiwi Control Graph](./docs/assets/graph-placeholder.png)

## Why Kiwi

Most agent tools either hide their reasoning in an editor plugin or centralize execution behind a cloud service. Kiwi takes the opposite approach:

- the repo is the source of truth
- `.agent/` artifacts are explicit and portable
- the backend is deterministic and inspectable
- the CLI is the real operational surface
- the desktop app is a thin shell over repo-local state, not a parallel runtime

## Features

- Repo-local execution planning and validation
- Context trees, context authority, and bounded file selection
- Checkpoints, handoffs, and continuity artifacts
- Machine advisory for toolchain, MCP, and usage health
- Cross-platform desktop shell via Tauri
- CLI-driven workflows for guide, next step, retry, validate, trace, and auto-run

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

### First repo flow

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

Use `--json` when you need machine-readable output.

## Desktop usage

The desktop shell currently includes:

- left rail navigation for Overview, Context, Graph, Tokens, Feedback, MCPs, Specialists, System, Validation, and Machine
- center workspace with execution plan, context tree, graph view, and operator cards
- right inspector for reasoning, validation, and control actions
- interactive command bar wired to Kiwi CLI flows

## Architecture

Kiwi Control is a 3-layer monorepo:

- `packages/sj-core` — repo-local engine, planning, selection, eval, validation, repo-state aggregation
- `packages/sj-cli` — installable CLI over `sj-core`
- `apps/sj-ui` — Tauri desktop shell over repo and CLI state

```text
repo files + .agent artifacts
          |
          v
      packages/sj-core
          |
   +------+------+
   |             |
   v             v
packages/sj-cli  runtime/ui-bridge
   |             |
   +------+------+
          |
          v
   apps/sj-ui (Tauri desktop)
```

For the contributor-oriented version, read [ARCHITECTURE.md](./ARCHITECTURE.md).

## Development

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

## Project goals

Kiwi Control is intentionally:

- repo-first
- local-first
- additive
- non-destructive
- explicit about limits and confidence

It is intentionally not:

- a generic agent runtime replacement
- a hidden automation layer
- a cloud-required control plane
- a destructive “auto-fix everything” tool

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

See [LICENSE.md](./LICENSE.md).
