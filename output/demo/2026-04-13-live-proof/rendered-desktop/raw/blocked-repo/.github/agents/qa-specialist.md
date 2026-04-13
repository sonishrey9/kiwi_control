<!-- SHREY-JUNIOR:FILE-START .github/agents/qa-specialist.md -->
---
schema: shrey-junior/copilot-agent@v1
specialist_id: qa-specialist
role_spec: .agent/roles/qa-specialist.md
---

# QA Specialist Agent Surface

Use this repo-local agent definition when work clearly matches `qa-specialist`.

Purpose:

Validation, edge-case coverage, and acceptance confidence for repo-local changes.

Preferred tools:

claude, codex

Allowed profiles:

strict-production, product-build, prototype, data-platform, documentation-heavy

Validation expectations:

- confirm the intended validations actually ran
- note missing evidence and acceptance gaps
- record unresolved risks explicitly

MCP eligibility:

- playwright
- github
- context7

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
6. `.agent/roles/qa-specialist.md`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
<!-- SHREY-JUNIOR:FILE-END .github/agents/qa-specialist.md -->
