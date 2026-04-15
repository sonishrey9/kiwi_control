# Architecture

For a public, diagram-driven explanation of the current system, also see [How Kiwi Control Works](./how-kiwi-control-works.md), [Architecture Diagrams](./architecture-diagrams.md), and [Architecture FAQ](./architecture-faq.md).

## Goal

`shrey-junior` is a thin compiler from canonical repo-local control data into native instruction surfaces for:

- Codex
- Claude Code
- GitHub Copilot

It is not an agent runtime, not a plugin loader, and not a replacement for those tools.

## Design rule

Global discoverability, repo-local operation.

- global defaults may help bootstrap new folders
- repo-local overlays still own actual working behavior
- existing repo authority still beats machine-level convenience

## Source-of-truth flow

```text
configs/ + prompts/ + templates/
            |
            v
   config loader + profile resolution
            |
            v
  context compiler + conflict detector
            |
            v
  router + packet renderer + validators
            |
            v
 bootstrap / discovery / init / sync / run / fanout / check
            |
            v
 checkpoint / handoff / status / push-check
            |
            v
 dispatch / collect / reconcile
            |
            v
 native repo outputs
   - AGENTS.md
   - CLAUDE.md
   - .github/copilot-instructions.md
   - .agent/*
   - .agent/state/*
```

## Authority model

- Canonical authority: `configs/`, `prompts/`, `templates/`
- Generated outputs: derived artifacts only
- Repo-local overlays: allowed and portable
- Machine-local state: reference only
- Optional global defaults: bootstrap hints only
- CLI flags may override profile defaults, but only for the current command
- Existing repo authority files and repo-routed canonical docs explicitly referenced by them win over generated overlays

## Profiles

Profiles are canonical config, not ad hoc repo logic.

- `strict-production`: strongest guardrails and backup-first sync defaults
- `product-build`: balanced daily-driver mode
- `prototype`: fast local iteration with bounded inline edits
- `data-platform`: stronger planning/review around migrations and data work
- `documentation-heavy`: bias toward planning and docs-oriented packets

The selected profile is written into `.agent/project.yaml` and then reused by `sync`, `run`, `fanout`, and `check`.

## Routing

Routing is intentionally explainable.

1. explicit CLI tool override
2. repo profile defaults
3. inferred task type
4. risk escalation
5. file area override
6. fallback default

Routing never starts live execution. It only shapes generated task packets and validation expectations.

## Adapters

### Codex adapter

- emits `AGENTS.md` compatible content
- appends a managed block when `AGENTS.md` already exists
- creates a fully managed `AGENTS.md` only when missing

### Claude adapter

- emits `CLAUDE.md` compatible content
- keeps repo-local guidance intentionally light
- does not edit `~/.claude/settings.json`
- does not generate invasive `.claude` runtime config in v2

### Copilot adapter

- emits `.github/copilot-instructions.md`
- appends a managed block to existing repo instructions
- architecture leaves room for future path-specific instructions

## Repo-local state

`.agent/` is the portable repo-local overlay for v2.

- `.agent/project.yaml`
- `.agent/checks.yaml`
- `.agent/context/*`
- `.agent/tasks/*`
- `.agent/state/current-phase.json`
- `.agent/state/history/*`
- `.agent/state/handoff/*`
- `.agent/state/dispatch/*`

These files are fully managed and can be regenerated.

## Global home

The optional machine-level home is intentionally narrow:

- `~/.shrey-junior/configs/`
- `~/.shrey-junior/prompts/`
- `~/.shrey-junior/specialists/`
- `~/.shrey-junior/policies/`
- `~/.shrey-junior/mcp/`
- `~/.shrey-junior/defaults/`
- `~/.shrey-junior/adapters/`
- `~/.shrey-junior/bin/`

It is only consulted for bootstrap-style starter defaults unless you explicitly expand its role later.

## Phase continuity

Phase continuity is intentionally small and explicit.

- `checkpoint` records a structured snapshot of the current phase
- `handoff` packages that snapshot for a specific next tool
- `status` summarizes the repo-local control state
- `push-check` reads safe git metadata and checkpoint health to produce a push gate

Execution state is now maintained by the standalone `kiwi-control-runtime` service, which persists repo-local SQLite WAL state and only mutates it when a user command or product action explicitly transitions execution. Broader repo continuity artifacts remain deliberate outputs rather than a general background scheduler.

## Controlled multi-role coordination

The coordination layer is intentionally file-based.

- `dispatch` creates a dispatch manifest and role assignment records
- `collect` summarizes which role outputs exist
- `reconcile` compares collected role outputs and creates a go / review / blocked recommendation

This is not a scheduler and not a swarm runtime. It is a coordination scaffold that helps Codex, Claude, Copilot, and future tools work from the same repo-local state, with the runtime daemon limited to authoritative execution-state persistence and revision delivery.

## Push-readiness model

Push readiness is a repo-local advisory check, not a git automation layer.

- `allowed`: git state is clean enough and the latest checkpoint looks complete
- `review-required`: work may be valid, but warnings, open issues, dirty tree state, or missing validations still need review
- `blocked`: the latest checkpoint is explicitly blocked
- `not-applicable`: target is not a git repo

## Context compilation

Before packet generation, `shrey-junior` compiles safe repo context from:

- `.agent/project.yaml`
- `.agent/checks.yaml`
- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agent/context/*`
- selected safe repo docs such as `README.md` or `docs/architecture.md`

The compiler produces:

- authority order
- repo context summary
- conflict report
- validation steps
- packet-safe MCP recommendations
- promoted canonical docs surfaced earlier than generic repo docs

## Tool-aware workflow guidance

Tool-facing overlays and packets now carry explicit workflow rules so Codex, Claude Code, and Copilot know when to:

- stay direct for trivial, local, low-risk work
- escalate into `run` for non-trivial single-owner work
- escalate into `fanout` for guarded or role-separated work
- escalate into `dispatch` / `collect` / `reconcile` for controlled simultaneous small-role work
- require `checkpoint` / `handoff` for cross-tool continuity
- require `push-check` before non-trivial push advice

This keeps one workflow model across tools without relying on any global config mutation.

## Safety model

All commands follow the same guardrails:

- sensitive paths are classified before reads
- risky files are metadata-only or refused
- no secrets are printed
- no global config is mutated
- no automatic push occurs
