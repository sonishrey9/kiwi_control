<!-- SHREY-JUNIOR:FILE-START .agent/tasks/run-20260402-162334-stabilize-shared-repo-guidance/copilot.md -->
# Copilot Run Packet

Objective: stabilize shared repo guidance

## Routing

- task type: `implementation`
- primary tool: `codex`
- review tool: `codex`
- execution mode: `assisted`
- risk: `low`
- file area: `application`
- change size: `medium`
- packet role: inline or local edit acceleration
- specialist: `python-specialist` (inferred)

## Repo Context Summary

- AGENTS.md: This file is intentionally unmanaged.
- copilot-instructions.md: This file is intentionally unmanaged.
- README.md: This sample project exists so `shrey-junior` can prove additive sync behavior.

## Workflow Decision Rules

- treat existing repo authority and promoted canonical docs as stronger than generated overlays
- trivial work may stay direct only when it is local, low-risk, and does not affect contracts, auth, data, security, release behavior, or multiple files
- if the task is non-trivial, continue within the Shrey Junior workflow instead of freeform improvisation
- escalate to fanout or dispatch if the work becomes cross-cutting, guarded, contract-sensitive, or needs reviewer/tester separation
- use checkpoint and handoff at meaningful phase boundaries or cross-tool transitions
- require push-check before recommending push on non-trivial or guarded work

## Authority Files To Read First

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `README.md`

## Specialist Guidance

- name: Python Specialist
- purpose: Safe Python and backend implementation follow-through with explicit boundaries and validation.
- risk posture: `medium`
- preferred tools: codex, claude
- validation expectations: run the smallest relevant repo test command; confirm touched files stay inside the allowed scope; report skipped validation explicitly
- result schema expectations: role, status, summary, validations, risks, touched_files, next_steps
- handoff guidance: surface stable contracts before implementation begins; hand off to qa-specialist or architecture-specialist for guarded review

## Stable Contracts

- `AGENTS.md`

## Allowed Scope

- files directly required for the requested goal
- repo-local instruction surfaces managed by shrey-junior
- validation files and tests needed to prove the change

## Forbidden Scope

- global tool config
- secret-bearing files
- machine-local session or workspace state
- unmanaged destructive overwrites
- unmanaged authority rewrites

## Exact Validation Steps

- validate canonical configs load
- keep managed markers stable
- run the smallest relevant repo checks
- report any skipped verification

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

- `.github/copilot-instructions.md`

## Control Plane Expectations

- prefer specialist-aware routing over generic freeform work when a clear specialist fit exists
- treat MCP usage as policy-driven by profile, specialist, trust, and approval rules
- stop and warn when authority files, reconcile state, or policy guidance conflict

## Eligible MCP References

- filesystem: local file access (trust=medium, readOnly=true, approvalRequired=true)
- context7: official documentation lookup (trust=high, readOnly=true, approvalRequired=false)

## Role Instructions

# Reviewer Packet

Goal: `stabilize shared repo guidance`

Project: `sample-project`
Profile: `product-build`

Review for:

- whether repo authority and promoted canonical docs were actually read first
- whether the task should have escalated into `fanout`, `dispatch`, `checkpoint`, `handoff`, or `push-check`
- regression risk
- instruction drift
- unsafe assumptions
- secret-handling mistakes
- managed marker violations
- authority-file conflicts
- missing validation or weak completion criteria
- specialist mismatch or policy-blind MCP usage

Primary output:

- findings first
- residual risks
- approval or follow-up recommendation
<!-- SHREY-JUNIOR:FILE-END .agent/tasks/run-20260402-162334-stabilize-shared-repo-guidance/copilot.md -->
