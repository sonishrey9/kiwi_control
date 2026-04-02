# Planner Packet

Goal: `{{goal}}`

Project: `{{projectName}}`
Profile: `{{profileName}}`
Execution mode: `{{executionMode}}`

Produce a constrained plan before implementation.

Requirements:

- read repo authority first, then promoted canonical docs, then current phase / handoff / reconcile state when present
- treat Shrey Junior as the control plane for non-trivial work
- preserve existing behavior
- prefer additive changes
- respect `.agent/*` as repo-local portable authority
- do not rely on machine-local state as source of truth
- do not expose or request secret values
- define validation before edits
- escalate when instructions conflict, the change is cross-cutting, or the work should move from direct handling into `fanout` or `dispatch`
- recommend specialist-aware routing when a clear specialist fit exists

Output:

- scope and non-goals
- assumptions and unknowns
- file-level plan
- validation plan
- escalation points
