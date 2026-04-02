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
3. `.agent/state/current-phase.json`
4. `latest.json` or the newest matching handoff
5. latest reconcile result
6. latest task packet set
