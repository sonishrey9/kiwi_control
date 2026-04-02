# Artifact Contracts

## Purpose

Shrey Junior coordinates through files so humans and tools can inspect the same state. The table below documents the main artifact contracts.

## Artifact Contract Table

| Artifact path | Purpose | Producer | Consumer | Required | Authority level | Visibility | Format |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `.agent/project.yaml` | Repo profile, contract metadata, precedence summary | `bootstrap`, `sync`, `standardize` | `status`, `check`, packet builders, humans | Required | Repo-local generated overlay | Cloud-visible | Human-readable YAML |
| `.agent/checks.yaml` | Required checks and contract expectations | `bootstrap`, `sync`, `standardize` | `status`, `check`, humans | Required | Repo-local generated overlay | Cloud-visible | Human-readable YAML |
| `.agent/state/current-phase.json` | Latest phase continuity record | `checkpoint`, bootstrap seed | `status`, `handoff`, agents, humans | Required | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/state/active-role-hints.json` | Current lead role, next reads, next writes, checks, stop conditions, and latest continuity pointers | bootstrap seed, `run`, `fanout`, `dispatch`, `checkpoint`, `handoff`, `reconcile` | `status`, cooperative runtimes, humans | Required | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/state/handoff/latest.json` | Latest cross-tool handoff | `handoff` | `status`, resuming tools | Optional | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/state/dispatch/latest-manifest.json` | Latest dispatch manifest | `dispatch` | `collect`, `reconcile`, humans | Optional | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/state/dispatch/latest-collect.json` | Latest dispatch collection summary | `collect` | `reconcile`, `status`, humans | Optional | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/state/reconcile/latest.json` | Latest reconcile report | `reconcile` | `status`, `push-check`, humans | Optional | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/state/latest-task-packets.json` | Pointer to newest packet set | `run`, `fanout`, `dispatch` | `status`, resuming tools | Optional | Runtime artifact | Cloud-visible | Structured JSON |
| `.agent/tasks/<packet-set>/*.md` | Role/task packet instructions | `run`, `fanout`, `dispatch` | agents and humans | Optional | Runtime artifact | Cloud-visible | Markdown with frontmatter |
| `.agent/roles/*.md` | Specialist role contracts | bootstrap/sync/standardize | packets, humans, cooperative tools | Required | Repo-local generated overlay | Cloud-visible | Markdown with frontmatter |
| `.agent/templates/role-result.md` | Structured result schema for role outputs | bootstrap/sync/standardize | role workers, collect/reconcile | Required | Repo-local generated overlay | Cloud-visible | Markdown |
| `.agent/scripts/verify-contract.sh` | Portable behavioral contract and CI push gate, with optional `push-check` invocation when the CLI is available | bootstrap/sync/standardize | CI workflow, humans | Required | Repo-local generated overlay | Cloud-visible | Bash + Python stdlib |

## Schema Conventions

- Task packets: `schema: shrey-junior/task-packet@v1`
- Specialist roles: `schema: shrey-junior/specialist-role@v1`
- Copilot agent docs: `schema: shrey-junior/copilot-agent@v1`
- Current phase: `artifactType: "shrey-junior/current-phase"`
- Active role hints: `artifactType: "shrey-junior/active-role-hints"`
- Handoff: `artifactType: "shrey-junior/handoff"`
- Dispatch manifest: `artifactType: "shrey-junior/dispatch-manifest"`
- Dispatch collection: `artifactType: "shrey-junior/dispatch-collect"`
- Reconcile report: `artifactType: "shrey-junior/reconcile-report"`
- Latest task packet set: `artifactType: "shrey-junior/latest-task-packets"`

## Latest-Pointer Strategy

Stable latest-pointer files exist so a tool can recover context without scanning history:

- `active-role-hints.json`
- `handoff/latest.json`
- `dispatch/latest-manifest.json`
- `dispatch/latest-collect.json`
- `reconcile/latest.json`
- `latest-task-packets.json`

These are portability helpers rather than stronger authority than the underlying history.

## Token Reduction Intent

The runtime artifacts are designed to reduce unnecessary exploration:

- `active-role-hints.json` should answer “who acts now, what should be read next, what should be written next, and which checks matter”
- task packets should answer “what is in scope, what is out of scope, and when to stop”
- handoff and reconcile artifacts should answer “what changed, what is still risky, and what the next tool should do”
