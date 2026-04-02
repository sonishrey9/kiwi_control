# shrey-junior

Thin repo-local control plane for:

- OpenAI Codex
- Claude Code
- GitHub Copilot

`shrey-junior` keeps one canonical set of configs, prompts, guardrails, and repo templates, then compiles them into each tool's native repo-level instruction surfaces.

## Global discoverability

The control plane is still repo-local by default, but it now has a safe global bootstrap path.

- `bootstrap` can initialize a brand new folder, an existing project, or an existing git repo
- optional global defaults may live under `~/.shrey-junior/`, but they are reference-only hints
- `scripts/install-global.sh` can prepare that home and install a launcher into `~/.local/bin` when you explicitly invoke it
- no Codex, Claude, Copilot, or VS Code global settings are changed by default

## V2 scope

V2 keeps the same safety model as v1 but is more useful in real repos.

- No global installs
- No edits to `~/.codex`, `~/.claude`, VS Code user settings, or workspace storage
- No live agent runtime
- No secret ingestion
- Repo-local overlays only
- Managed markers on every generated file or block
- Profile-aware routing
- Context compilation with authority order and conflict reporting
- Stronger task packets
- Safer sync with dry-run, diff summary, and backup support
- Repo-local phase continuity and controlled push-readiness checks
- Controlled dispatch / collect / reconcile flow for small parallel role work

## Source of truth

Canonical authority lives only in:

- `configs/`
- `prompts/`
- `templates/`

Generated files in target repos are outputs, not authority.

## What changed from v1

- added repo profiles such as `strict-production` and `product-build`
- added explainable routing by profile, task type, risk, file area, and execution mode
- added context compilation from safe repo-local surfaces
- upgraded `check` to validate routing, profiles, packets, and context conflicts
- upgraded `sync` to support `--dry-run`, `--diff-summary`, and `--backup`
- added `checkpoint`, `handoff`, `status`, and `push-check` for cross-tool phase continuity
- added `dispatch`, `collect`, and `reconcile` for controlled multi-role coordination
- added explicit tool-awareness guidance so Codex, Claude Code, and Copilot know when to stay lightweight and when to escalate into packets, coordination, continuity, and push/release gates

## Commands

```bash
npm install
npm run build

node dist/cli.js audit --target "/path/to/repo"
node dist/cli.js bootstrap --target "/path/to/folder" --dry-run
node dist/cli.js check --target "/path/to/repo" --profile strict-production
node dist/cli.js init --target "/path/to/repo" --profile product-build
node dist/cli.js sync --target "/path/to/repo" --dry-run --diff-summary
node dist/cli.js run "stabilize the auth flow" --target "/path/to/repo" --profile product-build --mode assisted
node dist/cli.js fanout "stabilize the auth flow" --target "/path/to/repo" --profile strict-production --mode guarded
node dist/cli.js checkpoint "phase 2 complete" --target "/path/to/repo" --tool codex --profile product-build --validations "npm test,manual review" --next "handoff to claude"
node dist/cli.js handoff --target "/path/to/repo" --to claude
node dist/cli.js status --target "/path/to/repo"
node dist/cli.js push-check --target "/path/to/repo"
node dist/cli.js dispatch "refactor the billing flow safely" --target "/path/to/repo" --profile strict-production --mode guarded
node dist/cli.js collect --target "/path/to/repo"
node dist/cli.js reconcile --target "/path/to/repo" --profile strict-production
```

Optional global install:

```bash
bash scripts/backup-global.sh
bash scripts/install-global.sh
bash scripts/apply-global-preferences.sh
bash scripts/verify-global.sh
bash scripts/verify-global-hard.sh
```

## Command behavior

- `audit`: scans safe instruction surfaces and writes a sanitized discovery report
- `bootstrap`: detects project shape, chooses a starter profile, and scaffolds repo-local overlays safely
- `check`: validates configs, profiles, routing, packet generation, marker integrity, and target repo health
- `init`: bootstraps repo-local overlays without overwriting unmanaged files silently
- `sync`: updates only managed blocks and managed files, with preview and backup support
- `run`: emits aligned, high-signal task packets for Codex, Claude Code, and Copilot
- `fanout`: emits planner / implementer / reviewer / tester packets with profile-aware guardrails
- `checkpoint`: records a structured, repo-local phase checkpoint without storing chat logs or secrets
- `handoff`: creates tool-specific handoff markdown, JSON, and a concise brief
- `status`: summarizes the active profile, latest phase, task packets, authority docs, git state, and any older blocked dispatch that should still stay visible
- `push-check`: reports whether the repo appears push-ready, review-needed, or blocked without pushing anything
- `dispatch`: creates a repo-local dispatch manifest plus planner / implementer / reviewer / tester assignments
- `collect`: summarizes which assigned roles have actually produced outputs, whether they used structured results, and which ones fell back to heuristics
- `reconcile`: compares collected role outputs and reports agreements, conflicts, missing validations, unresolved risks, role gaps, and the trust basis of the result

## Tool awareness

The repo-facing overlays now explicitly teach Codex, Claude Code, and Copilot how to use the control plane.

- existing repo authority and promoted canonical docs win over generated overlays
- trivial work may stay direct only when it is low-risk, local, and non-contract-changing
- non-trivial work should use `run`
- guarded or role-separated work should use `fanout`
- simultaneous small-role work should use `dispatch`, then `collect` and `reconcile`
- cross-tool continuity should use `checkpoint` and `handoff`
- non-trivial or guarded push advice should consult `push-check`
- late-phase review or release-sensitive work should consult `release-check` or `phase-close` when those commands exist

See [tool-awareness.md](/Volumes/shrey%20ssd/shrey-junior/docs/tool-awareness.md).
For first-run onboarding from an empty folder or existing repo, see [global-bootstrap.md](/Volumes/shrey%20ssd/shrey-junior/docs/global-bootstrap.md).
For the applied global integration strategy, see [global-integration.md](/Volumes/shrey%20ssd/shrey-junior/docs/global-integration.md).
For rollback-tested global surface recovery, see [tool-global-rollbacks.md](/Volumes/shrey%20ssd/shrey-junior/docs/tool-global-rollbacks.md).
For machine capability inventories, see [mcp-inventory.md](/Volumes/shrey%20ssd/shrey-junior/docs/mcp-inventory.md), [skill-inventory.md](/Volumes/shrey%20ssd/shrey-junior/docs/skill-inventory.md), and [specialists.md](/Volumes/shrey%20ssd/shrey-junior/docs/specialists.md).

## Profiles

Built-in profiles:

- `strict-production`
- `product-build`
- `prototype`
- `data-platform`
- `documentation-heavy`

Profiles influence routing, guardrails, packet defaults, sync behavior, and recommended checks. A target repo can override the default profile in `.agent/project.yaml`, while CLI flags take precedence.

## Routing

Routing stays simple and explainable. Priority order is:

1. explicit CLI tool override
2. repo profile
3. inferred task type
4. risk level
5. file area
6. fallback default

`run` and `fanout` do not execute agents. They generate packets that tell Codex, Claude Code, and Copilot what role each tool should play.

## Global defaults vs repo truth

Bootstrap resolves starter behavior conservatively:

1. existing trusted repo authority
2. repo-local Shrey Junior state
3. explicit CLI flags for bootstrap
4. optional global defaults in `~/.shrey-junior/defaults/bootstrap.yaml`
5. fallback starter mapping from detected project type
6. canonical default profile

See [defaults-precedence.md](/Volumes/shrey%20ssd/shrey-junior/docs/defaults-precedence.md).

## Phase continuity

`shrey-junior` now keeps a repo-local continuity ledger under `.agent/state/`.

- `current-phase.json`: latest recorded checkpoint
- `history/`: timestamped checkpoint history
- `handoff/`: tool-ready handoff markdown, JSON, and brief files

This is structured phase metadata only. It never stores secrets, raw chat logs, or global tool state.

`run` and `fanout` read the latest phase state when available so the next tool sees:

- previous phase summary
- previous tool
- changed files since last checkpoint
- open warnings and issues
- latest handoff summary

See [phase-continuity.md](/Volumes/shrey%20ssd/shrey-junior/docs/phase-continuity.md) for the full workflow.
See [multi-agent-coordination.md](/Volumes/shrey%20ssd/shrey-junior/docs/multi-agent-coordination.md) for the controlled dispatch / collect / reconcile flow.

## Push gating

`push-check` is read-only and conservative.

- It reads safe git metadata only.
- It does not commit, push, or mutate branch state.
- It uses checkpoint status, warnings, open issues, and recorded validations to label the repo:
- `allowed`
- `review-required`
- `blocked`
- `not-applicable`

## Controlled coordination

`shrey-junior` now supports small coordinated parallel work without becoming a swarm runtime.

- `dispatch` creates a structured manifest and role assignments.
- It references generated packets instead of launching agents.
- `collect` reads repo-local role outputs when humans or tools write them.
- `reconcile` compares those outputs and decides whether the work is ready, review-required, or blocked.

This stays file-based, repo-local, and explicit. There is no daemon, no automatic multi-agent execution, and no automatic push.

## Structured role results

For the most trustworthy `collect` and `reconcile` output, each role should write either:

- JSON with role/status/summary plus the coordination arrays
- Markdown with YAML frontmatter using the same fields

Loose markdown still works, but it is reported as heuristic fallback instead of structured evidence.

See [result-schema.md](/Volumes/shrey%20ssd/shrey-junior/docs/result-schema.md) and [structured-role-results.md](/Volumes/shrey%20ssd/shrey-junior/examples/flows/structured-role-results.md).

## Task packets

Packets now include:

- objective
- repo context summary
- authority files to read first
- allowed scope
- forbidden scope
- exact validation steps
- completion criteria
- output format
- escalation conditions
- previous phase and handoff summary when available

## Non-goals

- Replacing Codex, Claude Code, or Copilot
- Installing or mutating global tool config
- Automatically enabling global Shrey Junior integration
- Executing multi-agent swarms
- Reading secrets, session logs, or credential stores
- Managing production credentials or cloud secret values
- Generating invasive `.claude` runtime config
- Path-specific Copilot instructions in this phase
- Automatic git push or background continuity daemons
- Uncontrolled autonomous swarms or background coordination workers

## Managed files

See [managed-files.md](/Volumes/shrey%20ssd/shrey-junior/docs/managed-files.md) for marker rules and ownership.

## Example

`examples/sample-project/` is a small repo fixture used by the smoke test to prove:

- existing authority files are preserved
- managed blocks append safely
- missing files are created as managed outputs

See `examples/flows/` for realistic onboarding, bugfix, refactor, and packet-chain examples.
