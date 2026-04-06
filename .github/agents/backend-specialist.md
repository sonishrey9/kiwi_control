<!-- SHREY-JUNIOR:FILE-START .github/agents/backend-specialist.md -->
---
schema: shrey-junior/copilot-agent@v1
specialist_id: backend-specialist
role_spec: .agent/roles/backend-specialist.md
---

# Backend Specialist Agent Surface

Use this repo-local agent definition when work clearly matches `backend-specialist`.

Purpose:

API, service, persistence, and contract-safe backend delivery across Python, Node, and general server-side repos.

Preferred tools:

codex, claude

Allowed profiles:

strict-production, product-build, prototype, data-platform

Validation expectations:

- verify interface or contract changes explicitly
- run the narrowest backend or API validation available
- call out data, auth, or migration side effects

MCP eligibility:

- context7
- filesystem
- github
- docker
- supabase

Copilot note:

- treat MCP eligibility as repo-wide routing metadata, not proof that Copilot itself can execute those tools directly

Risk posture:

`medium`

Read first:

1. explicit repo authority
2. promoted canonical docs
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json`
6. `.agent/roles/backend-specialist.md`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
<!-- SHREY-JUNIOR:FILE-END .github/agents/backend-specialist.md -->
