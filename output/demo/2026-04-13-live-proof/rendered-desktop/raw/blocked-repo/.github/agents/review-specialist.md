<!-- SHREY-JUNIOR:FILE-START .github/agents/review-specialist.md -->
---
schema: shrey-junior/copilot-agent@v1
specialist_id: review-specialist
role_spec: .agent/roles/review-specialist.md
---

# Review Specialist Agent Surface

Use this repo-local agent definition when work clearly matches `review-specialist`.

Purpose:

General software engineering review for correctness, regression risk, contract safety, and change quality.

Preferred tools:

claude, codex

Allowed profiles:

strict-production, product-build, prototype, data-platform, documentation-heavy

Validation expectations:

- separate findings from summary
- call out missing evidence or weak logic explicitly
- escalate unresolved contract or release risk conservatively

MCP eligibility:

- context7
- filesystem
- github
- sequential-thinking

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
6. `.agent/roles/review-specialist.md`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
<!-- SHREY-JUNIOR:FILE-END .github/agents/review-specialist.md -->
