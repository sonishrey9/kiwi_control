<!-- SHREY-JUNIOR:FILE-START .github/agents/fullstack-specialist.md -->
---
schema: shrey-junior/copilot-agent@v1
specialist_id: fullstack-specialist
role_spec: .agent/roles/fullstack-specialist.md
---

# Fullstack Specialist Agent Surface

Use this repo-local agent definition when work clearly matches `fullstack-specialist`.

Purpose:

Balanced implementation specialist for app and web repos that cross frontend, backend, routing, and validation boundaries.

Preferred tools:

codex, claude, copilot

Allowed profiles:

strict-production, product-build, prototype, documentation-heavy

Validation expectations:

- identify touched boundary files before editing
- run at least one implementation validation and one review-oriented validation
- split reviewer or tester work when contracts or cross-cutting changes appear

MCP eligibility:

- context7
- filesystem
- github
- playwright
- docker

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
6. `.agent/roles/fullstack-specialist.md`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
<!-- SHREY-JUNIOR:FILE-END .github/agents/fullstack-specialist.md -->
