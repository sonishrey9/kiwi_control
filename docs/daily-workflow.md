# Daily Workflow

## Purpose

This guide describes the practical day-to-day path for using Kiwi Control with:

- local Codex-style agents
- local Claude-style agents
- VS Code Copilot workflows
- cloud or Cursor-like tools that can only see the repo

The operating rule is simple:

1. repo-local contract first
2. machine-global accelerators second
3. CI as the hard backstop

## One-Command Entry

If you want Kiwi Control to decide `bootstrap` versus `standardize` for you, install and use:

```bash
bash /path/to/shrey-junior/scripts/install-global.sh
sj-init
```

`sj-init` is a thin Bash entrypoint over the existing CLI. It:

- defaults to the current folder
- chooses `bootstrap` for empty or effectively empty folders
- chooses `standardize` for existing projects or git repos
- preserves repo-authority opt-out stand-down
- runs `status` and `check` after a real apply unless `--no-check` is passed

Useful variants:

```bash
sj-init --dry-run
sj-init --target /path/to/repo
sj-init --type python
sj-init --no-check
```

## Starting A New Repo

1. Create or choose the target folder.
2. Run:

```bash
sj-init --target /path/to/repo
```

3. Read, in order:
   - trusted repo authority files
   - `.agent/state/active-role-hints.json`
   - `.agent/state/current-phase.json`
   - `.agent/memory/current-focus.json`
   - `.agent/state/checkpoints/latest.json`
   - latest packet, handoff, dispatch, and reconcile pointers if present
   - `.agent/context/commands.md`
   - `.agent/context/specialists.md`
   - `.agent/context/tool-capabilities.md`
   - `.agent/context/mcp-capabilities.md`
   - relevant `.github/instructions/*.instructions.md`
   - `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`

4. Run:

```bash
kiwi-control status --target /path/to/repo
```

5. Before serious work, use the active role and latest continuity artifacts instead of scanning the whole repo from scratch.
6. Keep repo-local memory low-noise:
   - `repo-facts.json` for durable repo facts
   - `current-focus.json` for the shortest continuity summary
   - `open-risks.json` for unresolved risk carry-forward
   - the Markdown memory files only for durable, reusable repo knowledge
7. After meaningful work, record a checkpoint:

```bash
kiwi-control checkpoint "<milestone>" --target /path/to/repo
```

## Standardizing An Existing Repo

Use the explicit upgrade path:

```bash
sj-init --target /path/to/repo --dry-run
```

If you want to drive the lower-level commands directly:

```bash
kiwi-control standardize --target /path/to/repo --dry-run
```

If the preview looks correct:

```bash
sj-init --target /path/to/repo
```

Dry-run should tell you:

- which authority source won
- which profile was selected
- which role is active
- which repo-local surfaces will be installed
- which surfaces are skipped as irrelevant
- what verification commands to run next

If repo authority explicitly opts out, Kiwi Control should stand down.

## Resuming Work In A Repo

Start here, not with broad repo exploration:

1. `AGENTS.md` or `CLAUDE.md`
2. `.agent/state/active-role-hints.json`
3. `.agent/state/current-phase.json`
4. `.agent/state/checkpoints/latest.json`
5. `.agent/memory/current-focus.json`
6. `.agent/state/latest-task-packets.json`
7. `.agent/state/handoff/latest.json`
8. `.agent/state/reconcile/latest.json`
9. `.agent/context/commands.md`
10. `.agent/context/specialists.md`
11. `.agent/context/tool-capabilities.md`
12. `.agent/context/mcp-capabilities.md`
13. path-specific instruction files when relevant
14. `.agent/checks.yaml`

The intent is to make the next useful read obvious and keep token spend low.

## Running A Serious Task

Use `status` first:

```bash
kiwi-control status --target /path/to/repo
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

Use `handoff` whenever the next tool should not need to guess:

- who is handing off to whom
- what changed
- what evidence exists
- what risks remain
- what file to open next
- what command to consider next
- which MCP pack is the best fit

Checkpoint after coherent work instead of relying on long session memory:

```bash
kiwi-control checkpoint "<milestone>" --target /path/to/repo
```

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
- latest checkpoint
- latest task packet
- latest handoff
- latest reconcile
- current focus
- repo facts and durable repo memory
- checks and push expectations

Use machine-global accelerators for:

- reminding the tool to read repo-local state first
- making local invocation faster
- preloading a consistent operating model on this laptop

Do not treat machine-global files as the durable source of truth.

Machine-global installation notes:

- `scripts/install-global.sh` installs `sj-init` under `~/.shrey-junior/bin/sj-init`
- it creates a PATH-facing symlink at `~/.local/bin/sj-init`
- if `~/.local/bin` is not on PATH, the installer prints the exact export line to add

## Verification Before Review Or Push

Minimum:

```bash
kiwi-control check --target /path/to/repo
bash .agent/scripts/verify-contract.sh
```

When the CLI is available, the generated verifier also runs:

```bash
kiwi-control push-check --target /path/to/repo
```

CI reruns the same repo-local verifier. That is the hard backstop when prompts are not enough.

## Limits

- cloud tools may only see the repo, not `~/.codex`, `~/.claude`, or editor prompts
- Copilot is not a strict orchestration runtime
- hosted tools may partially honor repo-local instructions or continuity artifacts
- CI is stronger than prompt compliance
