<!-- SHREY-JUNIOR:FILE-START .github/agents/architecture-specialist.md -->
---
schema: shrey-junior/copilot-agent@v1
specialist_id: architecture-specialist
role_spec: .agent/roles/architecture-specialist.md
---

# Architecture Specialist Agent Surface

Use this repo-local agent definition when work clearly matches `architecture-specialist`.

Purpose:

Planning, decomposition, boundary analysis, and guarded change sequencing.

Preferred tools:

claude, codex

Allowed profiles:

strict-production, product-build, prototype, data-platform, documentation-heavy

Validation expectations:

- identify stable contracts and boundary files
- clarify sequencing before broad edits begin
- escalate cross-cutting risk conservatively

MCP eligibility:

- sequential-thinking
- context7
- github

Copilot note:

- treat MCP eligibility as repo-wide routing metadata, not proof that Copilot itself can execute those tools directly

Risk posture:

`conservative`

Read first:

1. explicit repo authority
2. promoted canonical docs
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json`
6. `.agent/roles/architecture-specialist.md`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
<!-- SHREY-JUNIOR:FILE-END .github/agents/architecture-specialist.md -->
