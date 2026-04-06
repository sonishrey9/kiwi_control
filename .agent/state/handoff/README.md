<!-- SHREY-JUNIOR:FILE-START .agent/state/handoff/README.md -->
# Handoff Artifacts

This directory stores handoff records between tools and phases.

Expected artifacts:

- timestamped `*.json` records for machine consumption
- timestamped `*.md` summaries for human review
- timestamped `*.brief.md` briefs for quick restart context
- `latest.json`, `latest.md`, and `latest.brief.md` when available

Read order for the next tool:

1. explicit repo authority
2. promoted canonical docs
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json`
6. `latest.json` or the newest matching handoff
7. latest reconcile result
8. latest task packet set

Every serious handoff should make these fields obvious:

- `fromRole`
- `toRole`
- `taskId`
- `summary`
- `workCompleted`
- `checksRun`
- `checksPassed`
- `checksFailed`
- `evidence`
- `openQuestions`
- `risks`
- `nextFile`
- `nextCommand`
- `recommendedMcpPack`
- `checkpointPointer`
<!-- SHREY-JUNIOR:FILE-END .agent/state/handoff/README.md -->
