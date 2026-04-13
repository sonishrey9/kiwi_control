<!-- SHREY-JUNIOR:FILE-START .github/agents/frontend-specialist.md -->
---
schema: shrey-junior/copilot-agent@v1
specialist_id: frontend-specialist
role_spec: .agent/roles/frontend-specialist.md
---

# Frontend Specialist Agent Surface

Use this repo-local agent definition when work clearly matches `frontend-specialist`.

Purpose:

UI and interaction work with emphasis on safe boundaries, browser evidence, and repo-aware frontend guidance.

Preferred tools:

codex, copilot, claude

Allowed profiles:

strict-production, product-build, prototype, documentation-heavy

Validation expectations:

- run the smallest frontend build or test loop available
- note missing browser evidence when UI behavior changed
- keep design or docs references explicit

MCP eligibility:

- context7
- filesystem
- github
- playwright
- figma

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
6. `.agent/roles/frontend-specialist.md`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
<!-- SHREY-JUNIOR:FILE-END .github/agents/frontend-specialist.md -->
