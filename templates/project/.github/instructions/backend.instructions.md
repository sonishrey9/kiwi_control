# Backend Workflow Instructions

Use this file when working on APIs, services, persistence, migrations, auth-sensitive code, or backend contracts.

Read first:

1. existing repo authority
2. promoted canonical docs
3. `.agent/project.yaml`
4. `.agent/checks.yaml`
5. `.agent/roles/backend-specialist.md`
6. current phase, latest handoff, latest reconcile

Escalate beyond direct editing when:

- backend work spans multiple files
- interfaces, schemas, or stable contracts change
- auth, data, security, or release behavior is affected
- reviewer or tester separation would materially improve confidence

Preferred workflow:

- `run` for focused backend work
- `fanout` for guarded backend changes
- `dispatch` when planner / implementer / reviewer / tester outputs should be compared explicitly
- `push-check` before recommending push
