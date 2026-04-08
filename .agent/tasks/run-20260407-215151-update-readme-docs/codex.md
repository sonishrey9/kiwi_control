<!-- SHREY-JUNIOR:FILE-START .agent/tasks/run-20260407-215151-update-readme-docs/codex.md -->
---
schema: shrey-junior/task-packet@v1
packet_type: run
title: "Codex Run Packet"
goal: "update README docs"
profile: product-build
execution_mode: assisted
task_type: docs
primary_tool: claude
review_tool: codex
supporting_role: "review and risk gate support"
native_surface: AGENTS.md
specialist: frontend-specialist
read_first:
  - "AGENTS.md"
  - "CLAUDE.md"
  - ".github/copilot-instructions.md"
  - ".agent/project.yaml"
  - ".agent/checks.yaml"
  - ".agent/state/context-tree.json"
  - ".agent/memory/repo-facts.json"
  - ".agent/memory/current-focus.json"
  - ".agent/memory/open-risks.json"
  - ".github/instructions/backend.instructions.md"
  - ".github/instructions/frontend.instructions.md"
  - ".github/agents/architecture-specialist.md"
  - ".github/agents/backend-specialist.md"
  - ".github/agents/frontend-specialist.md"
  - ".github/agents/fullstack-specialist.md"
  - ".github/agents/qa-specialist.md"
  - ".github/agents/review-specialist.md"
  - ".github/agents/shrey-junior.md"
  - ".agent/roles/README.md"
  - ".agent/roles/architecture-specialist.md"
  - ".agent/roles/backend-specialist.md"
  - ".agent/roles/frontend-specialist.md"
  - ".agent/roles/fullstack-specialist.md"
  - ".agent/roles/qa-specialist.md"
  - ".agent/roles/review-specialist.md"
  - "README.md"
  - "docs/architecture.md"
  - ".agent/state/active-role-hints.json"
  - ".agent/state/current-phase.json"
  - ".agent/state/checkpoints/latest.json"
  - ".agent/state/latest-task-packets.json"
  - ".agent/state/handoff/latest.json"
  - ".agent/state/reconcile/latest.json"
  - ".agent/state/dispatch/latest-manifest.json"
  - ".agent/context/commands.md"
  - ".agent/context/specialists.md"
  - ".agent/context/tool-capabilities.md"
  - ".agent/context/mcp-capabilities.md"
  - ".agent/context/context-tree.json"
  - ".agent/templates/role-result.md"
  - ".agent/scripts/verify-contract.sh"
write_targets:
  - "read carefully before editing: `package.json`"
  - "read carefully before editing: `.github/workflows`"
  - "update matching contract if touched: `AGENTS.md`"
  - "update matching contract if touched: `CLAUDE.md`"
  - ".agent/tasks/*"
  - ".agent/state/current-phase.json"
  - ".agent/state/checkpoints/*"
  - ".agent/state/handoff/*"
  - ".agent/state/dispatch/*"
  - ".agent/state/reconcile/*"
  - ".agent/memory/current-focus.json"
  - ".agent/memory/open-risks.json"
checks_to_run:
  - ".agent/checks.yaml"
  - "bash .agent/scripts/verify-contract.sh"
  - "canonical config files parse successfully"
  - "generated files contain valid start and end markers"
  - "AGENTS.md, CLAUDE.md, Copilot instructions, and repo-local instruction/agent surfaces route to the Shrey Junior contract"
  - "specialist role specs and Copilot-friendly agent docs exist for the repo-local contract"
  - "current phase, handoff, dispatch, reconcile, and latest packet artifacts follow stable file-based contracts"
  - "no risky files are directly ingested by shrey-junior"
  - "routing resolves clearly for the selected profile and task type"
  - "the repo profile resolves cleanly from CLI or .agent/project.yaml"
  - "run and fanout packets compile with usable instructions"
  - "authority files do not disagree about safety or ownership rules"
  - "tool-facing repo instructions explain trivial vs non-trivial thresholds and escalation to run, fanout, dispatch, checkpoint, handoff, and push-check"
  - "current phase, handoff, and reconcile artifacts are consulted before restarting non-trivial work"
  - "specialists and MCPs are treated as policy-driven aids rather than generic freeform tools"
  - "repo-local CI or equivalent verification exists to enforce the contract when prompts are not enough"
  - "bootstrap selected a starter profile from repo authority, repo-local state, CLI, global defaults, or safe metadata without overwriting repo truth"
  - "any global defaults are reference-only starter hints and never outrank existing repo authority"
  - "kiwi-control push-check when the CLI is available"
stop_conditions:
  - "stop when explicit repo authority or promoted canonical docs conflict with the requested action"
  - "stop when active phase, handoff, dispatch, or reconcile state is blocked or stale"
  - "stop when the change expands beyond the stated task packet scope or latest next step"
  - "stop when a stable contract, auth flow, data boundary, or release surface must change without updated checks"
  - "stop when required packets, role outputs, or continuity artifacts are missing"
external_lookup:
  inspect_codebase_first: true
  repo_docs_first: true
  use_external_lookup_when:
    - "repo authority or promoted docs explicitly point to external docs, APIs, or live systems"
    - "the task depends on current tool behavior, version-sensitive docs, cloud service behavior, or browser/runtime behavior"
    - "repo-local artifacts are insufficient to resolve an ambiguity after inspecting the codebase first"
  avoid_external_lookup_when:
    - "the repo-local contract, packets, or codebase already answers the question"
    - "the task is a local mechanical edit, refactor, formatting fix, or narrow docs update"
    - "external search would replace reading the active packet, latest handoff, or latest reconcile first"
---
# Codex Run Packet

Objective: update README docs

## Read This First

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.agent/project.yaml`
- `.agent/checks.yaml`
- `.agent/state/context-tree.json`
- `.agent/memory/repo-facts.json`
- `.agent/memory/current-focus.json`
- `.agent/memory/open-risks.json`
- `.github/instructions/backend.instructions.md`
- `.github/instructions/frontend.instructions.md`
- `.github/agents/architecture-specialist.md`
- `.github/agents/backend-specialist.md`
- `.github/agents/frontend-specialist.md`
- `.github/agents/fullstack-specialist.md`
- `.github/agents/qa-specialist.md`
- `.github/agents/review-specialist.md`
- `.github/agents/shrey-junior.md`
- `.agent/roles/README.md`
- `.agent/roles/architecture-specialist.md`
- `.agent/roles/backend-specialist.md`
- `.agent/roles/frontend-specialist.md`
- `.agent/roles/fullstack-specialist.md`
- `.agent/roles/qa-specialist.md`
- `.agent/roles/review-specialist.md`
- `README.md`
- `docs/architecture.md`
- `.agent/state/active-role-hints.json`
- `.agent/state/current-phase.json`
- `.agent/state/checkpoints/latest.json`
- `.agent/state/latest-task-packets.json`
- `.agent/state/handoff/latest.json`
- `.agent/state/reconcile/latest.json`
- `.agent/state/dispatch/latest-manifest.json`
- `.agent/context/commands.md`
- `.agent/context/specialists.md`
- `.agent/context/tool-capabilities.md`
- `.agent/context/mcp-capabilities.md`
- `.agent/context/context-tree.json`
- `.agent/templates/role-result.md`
- `.agent/scripts/verify-contract.sh`

## Exact Write Targets

- read carefully before editing: `package.json`
- read carefully before editing: `.github/workflows`
- update matching contract if touched: `AGENTS.md`
- update matching contract if touched: `CLAUDE.md`
- .agent/tasks/*
- .agent/state/current-phase.json
- .agent/state/checkpoints/*
- .agent/state/handoff/*
- .agent/state/dispatch/*
- .agent/state/reconcile/*
- .agent/memory/current-focus.json
- .agent/memory/open-risks.json

## Exact Checks To Run

- .agent/checks.yaml
- bash .agent/scripts/verify-contract.sh
- canonical config files parse successfully
- generated files contain valid start and end markers
- AGENTS.md, CLAUDE.md, Copilot instructions, and repo-local instruction/agent surfaces route to the Shrey Junior contract
- specialist role specs and Copilot-friendly agent docs exist for the repo-local contract
- current phase, handoff, dispatch, reconcile, and latest packet artifacts follow stable file-based contracts
- no risky files are directly ingested by shrey-junior
- routing resolves clearly for the selected profile and task type
- the repo profile resolves cleanly from CLI or .agent/project.yaml
- run and fanout packets compile with usable instructions
- authority files do not disagree about safety or ownership rules
- tool-facing repo instructions explain trivial vs non-trivial thresholds and escalation to run, fanout, dispatch, checkpoint, handoff, and push-check
- current phase, handoff, and reconcile artifacts are consulted before restarting non-trivial work
- specialists and MCPs are treated as policy-driven aids rather than generic freeform tools
- repo-local CI or equivalent verification exists to enforce the contract when prompts are not enough
- bootstrap selected a starter profile from repo authority, repo-local state, CLI, global defaults, or safe metadata without overwriting repo truth
- any global defaults are reference-only starter hints and never outrank existing repo authority
- kiwi-control push-check when the CLI is available

## Stop Conditions

- stop when explicit repo authority or promoted canonical docs conflict with the requested action
- stop when active phase, handoff, dispatch, or reconcile state is blocked or stale
- stop when the change expands beyond the stated task packet scope or latest next step
- stop when a stable contract, auth flow, data boundary, or release surface must change without updated checks
- stop when required packets, role outputs, or continuity artifacts are missing

## External Lookup Rules

- inspect the repo codebase first before external search
- prefer promoted repo docs or linked canonical docs before internet search
- use external lookup when: repo authority or promoted docs explicitly point to external docs, APIs, or live systems
- use external lookup when: the task depends on current tool behavior, version-sensitive docs, cloud service behavior, or browser/runtime behavior
- use external lookup when: repo-local artifacts are insufficient to resolve an ambiguity after inspecting the codebase first
- avoid external lookup when: the repo-local contract, packets, or codebase already answers the question
- avoid external lookup when: the task is a local mechanical edit, refactor, formatting fix, or narrow docs update
- avoid external lookup when: external search would replace reading the active packet, latest handoff, or latest reconcile first

## Routing

- task type: `docs`
- primary tool: `claude`
- review tool: `codex`
- execution mode: `assisted`
- risk: `low`
- file area: `docs`
- change size: `medium`
- packet role: review and risk gate support
- specialist: `frontend-specialist` (inferred)

## Repo Context

- canonical doc: commands.md: This file is generated by Shrey Junior.
- canonical doc: specialists.md: This file is generated by Shrey Junior.
- AGENTS.md: Kiwi Control is a thin repo-local control plane.
- CLAUDE.md: **IMPORTANT: This project has a knowledge graph. ALWAYS use the
- copilot-instructions.md: **IMPORTANT: This project has a knowledge graph. ALWAYS use the
- project.yaml: yaml context

## Role References

- `.agent/templates/role-result.md`
- `.agent/roles/frontend-specialist.md`
- `.github/agents/frontend-specialist.md`

## Specialist Guidance

- name: Frontend Specialist
- purpose: UI and interaction work with emphasis on safe boundaries, browser evidence, and repo-aware frontend guidance.
- risk posture: `medium`
- preferred tools: codex, copilot, claude
- validation expectations: run the smallest frontend build or test loop available; note missing browser evidence when UI behavior changed; keep design or docs references explicit
- result schema expectations: role, status, summary, validations, risks, touched_files, next_steps
- handoff guidance: promote read-first UI docs and boundary files before edits; route guarded UI changes through reviewer or qa-specialist coverage

## Relevant Repo Files

- `AGENTS.md`
- `CLAUDE.md`
- `package.json`
- `.github/workflows`

## Allowed Scope

- files directly required for the requested goal
- repo-local instruction surfaces managed by shrey-junior
- validation files and tests needed to prove the change
- documentation and context files needed for the requested update

## Forbidden Scope

- global tool config
- secret-bearing files
- machine-local session or workspace state
- unmanaged destructive overwrites
- unmanaged authority rewrites
## Completion Criteria

- goal satisfied with the smallest safe diff
- managed marker ownership remains intact
- relevant validation steps were run or explicitly skipped with a reason
- remaining risks are reported clearly

## Output Format

- summary
- files changed or reviewed
- validation run
- remaining risks or blockers

## Escalation Conditions

- goal requires global config mutation
- secret-bearing or metadata-only files would need to be ingested directly
- managed block ownership is ambiguous
- instruction surfaces disagree about authority or safety rules

## Native Surface

- `AGENTS.md`

## Continuity

- current focus: Review .agent/context/context-tree.json, then record a checkpoint before non-trivial implementation or handoff.
- focus owner: `fullstack-specialist`
- focus next specialist: `fullstack-specialist`
- focus MCP pack: `core-pack`
- focus next file: `.agent/context/context-tree.json`
- focus next command: kiwi-control checkpoint "context seeded"
- latest checkpoint: `bootstrap initialized` (2026-04-06T15:07:32.854Z)
- checkpoint summary: Bootstrap seed only. Fill in the repo context, then replace this with a real checkpoint after meaningful work.
- checkpoint next action: Review .agent/context/context-tree.json, then record a checkpoint before non-trivial implementation or handoff.
- checkpoint next command: kiwi-control checkpoint "context seeded"
- latest phase: `bootstrap-initialized` (complete)
- phase label: bootstrap initialized
- validations: portable repo contract installed

## Eligible MCP References

- context7: official documentation lookup (trust=high, readOnly=true, approvalRequired=false)
- github: GitHub repository metadata and automation (trust=high, readOnly=true, approvalRequired=true)
- playwright: browser automation (trust=high, readOnly=false, approvalRequired=true)
- figma: design context, screenshots, and code-connect mapping for design-to-code work (trust=high, readOnly=true, approvalRequired=true)
- cloudflare-docs: official Cloudflare product documentation lookup (trust=high, readOnly=true, approvalRequired=false)
- filesystem: local file access (trust=medium, readOnly=true, approvalRequired=true)

## Role Instructions

# Implementer Packet

Goal: `update README docs`

Project: `shrey-junior`
Profile: `product-build`
Execution mode: `assisted`

Implement the smallest safe change that satisfies the goal.

Constraints:

- read repo authority first, then promoted canonical docs, then current phase / handoff / reconcile state when present
- treat this packet as a non-trivial control-plane-guided task, not a generic freeform edit
- preserve existing working behavior
- prefer minimal diffs
- update only managed files when syncing instructions
- do not change global tool settings
- do not ingest secrets
- stop and escalate if authority files conflict
- do not widen scope without explaining why
- if the task becomes guarded, cross-cutting, contract-sensitive, or reviewer/tester-dependent, recommend `fanout` or `dispatch` instead of pretending the work is still simple
- follow specialist-aware routing when a relevant specialist is present

Always report:

- files changed
- verification run
- remaining risks
<!-- SHREY-JUNIOR:FILE-END .agent/tasks/run-20260407-215151-update-readme-docs/codex.md -->
