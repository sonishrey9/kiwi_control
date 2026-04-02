# Daily Workflow

## Purpose

This guide describes the practical day-to-day path for using Shrey Junior with:

- local Codex-style agents
- local Claude-style agents
- VS Code Copilot workflows
- cloud or Cursor-like tools that can only see the repo

The operating rule is simple:

1. repo-local contract first
2. machine-global accelerators second
3. CI as the hard backstop

## Starting A New Repo

1. Create or choose the target folder.
2. Run:

```bash
shrey-junior bootstrap --target /path/to/repo
```

3. Read, in order:
   - trusted repo authority files
   - `.agent/state/active-role-hints.json`
   - `.agent/state/current-phase.json`
   - latest packet, handoff, dispatch, and reconcile pointers if present
   - relevant `.github/instructions/*.instructions.md`
   - `.agent/checks.yaml`

4. Run:

```bash
shrey-junior status --target /path/to/repo
```

5. Before serious work, use the active role and latest continuity artifacts instead of scanning the whole repo from scratch.

## Standardizing An Existing Repo

Use the explicit upgrade path:

```bash
shrey-junior standardize --target /path/to/repo --dry-run
```

If the preview looks correct:

```bash
shrey-junior standardize --target /path/to/repo --backup
```

Dry-run should tell you:

- which authority source won
- which profile was selected
- which role is active
- which repo-local surfaces will be installed
- which surfaces are skipped as irrelevant
- what verification commands to run next

If repo authority explicitly opts out, Shrey Junior should stand down.

## Resuming Work In A Repo

Start here, not with broad repo exploration:

1. `AGENTS.md` or `CLAUDE.md`
2. `.agent/state/active-role-hints.json`
3. `.agent/state/current-phase.json`
4. `.agent/state/latest-task-packets.json`
5. `.agent/state/handoff/latest.json`
6. `.agent/state/reconcile/latest.json`
7. path-specific instruction files when relevant
8. `.agent/checks.yaml`

The intent is to make the next useful read obvious and keep token spend low.

## Running A Serious Task

Use `status` first:

```bash
shrey-junior status --target /path/to/repo
```

Then choose the workflow:

- `run` for one bounded serious task
- `fanout` when planner and reviewer separation matters
- `dispatch` when multiple roles need coordinated outputs

Each packet should tell the tool:

- what to read first
- what to write
- what checks to run
- when to stop
- when external lookup is justified

## Working Across Codex, Claude, And Copilot

### Codex

- best when it can read repo-local artifacts and invoke `shrey-junior`
- machine-global `~/.codex/AGENTS.md` and `~/.codex/config.toml` should accelerate orientation, not override the repo

### Claude Code

- best when it reads repo-local `CLAUDE.md`, active-role hints, current phase, and latest handoff first
- machine-global `~/.claude/CLAUDE.md`, `settings.json`, and Shrey commands should steer it back to the repo-local contract

### Copilot

- relies on repo-local `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, and `.github/agents/*.md`
- remains suggestion-oriented, so keep instructions concise and path-specific

### Cursor Or Similar Tools

- no special machine-local adapter is assumed
- compatibility comes from the repo-local contract, not a proprietary config format

## Repo-Local State Versus Machine-Global Accelerators

Use repo-local state for:

- active role
- current phase
- latest task packet
- latest handoff
- latest reconcile
- checks and push expectations

Use machine-global accelerators for:

- reminding the tool to read repo-local state first
- making local invocation faster
- preloading a consistent operating model on this laptop

Do not treat machine-global files as the durable source of truth.

## Verification Before Review Or Push

Minimum:

```bash
shrey-junior check --target /path/to/repo
bash .agent/scripts/verify-contract.sh
```

When the CLI is available, the generated verifier also runs:

```bash
shrey-junior push-check --target /path/to/repo
```

CI reruns the same repo-local verifier. That is the hard backstop when prompts are not enough.

## Limits

- cloud tools may only see the repo, not `~/.codex`, `~/.claude`, or editor prompts
- Copilot is not a strict orchestration runtime
- hosted tools may partially honor repo-local instructions or continuity artifacts
- CI is stronger than prompt compliance
