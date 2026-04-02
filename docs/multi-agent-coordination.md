# Multi-Agent Coordination

`shrey-junior` supports controlled simultaneous small-role work without introducing a swarm runtime.

## Commands

```bash
node dist/cli.js dispatch "refactor the billing flow safely" --target "/path/to/repo" --profile strict-production --mode guarded
node dist/cli.js collect --target "/path/to/repo"
node dist/cli.js reconcile --target "/path/to/repo" --profile strict-production
```

## What dispatch does

- generates or references planner / implementer / reviewer / tester packets
- creates `.agent/state/dispatch/<dispatch-id>/manifest.json`
- creates per-role assignment files under `roles/`
- declares intended tool, required status, packet path, and expected result paths
- teaches each role which packet and promoted docs to read first
- does not launch agents automatically

## What collect does

- scans the expected result paths for each assigned role
- records which roles are pending, active, complete, or blocked
- prefers structured JSON or markdown-with-frontmatter when available
- reports malformed structured outputs, partial structured outputs, and heuristic fallback roles
- writes `collect-latest.json` and collection history under the dispatch directory

## What reconcile does

- compares collected role outputs
- summarizes agreements
- surfaces conflicts
- records missing validations
- lists unresolved risks
- records role status gaps
- reports whether the conclusion is mostly structured or heuristic
- recommends one next step

Outputs:

- `reconcile-latest.json`
- `reconcile-latest.md`

## Result file conventions

Role outputs are repo-local and explicit.

- Preferred: JSON or markdown-with-frontmatter using the structured role-result schema
- Supported fallback: loose markdown with tagged lines such as `agreement:`, `conflict:`, `validation:`, `risk:`, `touched_file:`, and `next_step:`

See [result-schema.md](/Volumes/shrey%20ssd/shrey-junior/docs/result-schema.md) for the exact contract.

## Canonical docs

If trusted repo authority files explicitly point to a safe canonical doc such as `docs/agent-shared.md`, that doc is promoted earlier in:

- packets
- handoffs
- dispatch manifests
- reconcile reports

This promotion is shallow and explicit. `shrey-junior` does not deep-crawl the repo.

## When to use coordination

- use direct work only for trivial, local, low-risk fixes
- use `run` for non-trivial single-owner work
- use `fanout` when role separation is needed but work is still sequential
- use `dispatch` / `collect` / `reconcile` when small-role outputs may be produced in parallel and must be compared before trusting the result

## Status visibility

`status` shows:

- the latest dispatch
- the latest blocked dispatch if it is different
- the latest reconcile outcome
- counts of pending, active, blocked, and complete dispatches

That keeps an older blocked reconcile visible even after a newer dispatch has started.
