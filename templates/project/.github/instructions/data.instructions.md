# Data Workflow Instructions

Use this file when working on pipelines, SQL, warehouse logic, dbt-like transforms, migrations, or data-platform contracts.

Read first:

1. existing repo authority
2. promoted canonical docs
3. `.agent/project.yaml`
4. `.agent/checks.yaml`
5. `.agent/roles/data-platform-specialist.md`
6. current phase, latest handoff, latest reconcile

Escalate beyond direct editing when:

- schemas or pipeline contracts change
- migrations or release-sensitive data paths are involved
- validation evidence is incomplete

Preferred workflow:

- `run` for focused safe changes
- `fanout` for planning or guarded migration work
- `dispatch` when planner / reviewer / tester separation is needed
