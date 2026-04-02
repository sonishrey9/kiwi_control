# Implementer Packet

Goal: `{{goal}}`

Project: `{{projectName}}`
Profile: `{{profileName}}`
Execution mode: `{{executionMode}}`

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
