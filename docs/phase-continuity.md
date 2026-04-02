# Phase Continuity

`shrey-junior` supports controlled cross-tool continuity without introducing a background runtime.

## What is stored

Repo-local continuity lives under `.agent/state/`.

- `current-phase.json`: latest checkpoint
- `history/*.json`: immutable checkpoint history
- `handoff/*.md`: human-readable handoff
- `handoff/*.json`: machine-readable handoff
- `handoff/*.brief.md`: short "read this first" brief

Stored fields are safe metadata only:

- timestamp
- phase id
- goal
- profile
- mode
- selected or previous tool
- routing summary
- authority files used
- changed file summary
- validations run
- warnings
- open issues
- next recommended step
- status

It does not store secrets, raw prompts, or chat/session logs.

## Workflow

1. Run or fan out work for a repo.
2. When a phase reaches a meaningful boundary, record a checkpoint.
3. Generate a handoff for the next tool.
4. The next tool reads the brief and continues with the latest phase state already embedded in packets.
5. If parallel role work is active, `status` also shows whether an older blocked dispatch still needs attention.

Tool-awareness expectation:

- if work is non-trivial and a current phase exists, tools should read the current phase, latest handoff, and latest reconcile before restarting
- if a tool is taking over after another tool, `checkpoint` and `handoff` are the default continuity path instead of rebuilding context from scratch

## Coordination with multiple small roles

If a phase needs simultaneous small-role work, use the coordination layer after packet generation:

1. `dispatch` creates planner / implementer / reviewer / tester assignments.
2. Each tool or person writes role output into the repo-local dispatch result paths.
3. `collect` summarizes what has actually been completed.
4. `reconcile` compares the outputs and decides whether the work is ready, review-required, or blocked.

When roles use structured result files, the continuity layer can carry stronger evidence into the next handoff. When it falls back to loose markdown, the later handoff and reconcile reports say so explicitly.

This keeps the same safety model as phase continuity:

- no global mutation
- no background workers
- no raw session storage
- no automatic push

## Commands

```bash
node dist/cli.js checkpoint "phase 2 complete" --target "/path/to/repo" --tool codex --profile product-build --validations "npm test,manual review" --next "handoff to claude"
node dist/cli.js handoff --target "/path/to/repo" --to claude
node dist/cli.js status --target "/path/to/repo"
node dist/cli.js push-check --target "/path/to/repo"
```

## Push gating

`push-check` never pushes automatically.

It looks at:

- git branch and working tree summary
- recorded validations
- warnings and open issues from the latest checkpoint
- whether the latest phase is complete, blocked, or still in progress

The result is one of:

- `allowed`
- `review-required`
- `blocked`
- `not-applicable`

This is an advisory control, not a replacement for human review.
