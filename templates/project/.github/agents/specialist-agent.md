---
schema: shrey-junior/copilot-agent@v1
specialist_id: {{specialistId}}
role_spec: {{specialistRoleSpecPath}}
---

# {{specialistName}} Agent Surface

Use this repo-local agent definition when work clearly matches `{{specialistId}}`.

Purpose:

{{specialistPurpose}}

Preferred tools:

{{specialistPreferredTools}}

Allowed profiles:

{{specialistAllowedProfiles}}

Validation expectations:

{{specialistValidationExpectations}}

MCP eligibility:

{{specialistMcpEligibility}}

Copilot note:

- treat MCP eligibility as repo-wide routing metadata, not proof that Copilot itself can execute those tools directly

Risk posture:

`{{specialistRiskPosture}}`

Read first:

1. explicit repo authority
2. promoted canonical docs
3. `.agent/state/active-role-hints.json`
4. `.agent/state/current-phase.json`
5. `.agent/memory/current-focus.json`
6. `{{specialistRoleSpecPath}}`
7. latest task packet, latest handoff, and latest reconcile
8. `.agent/checks.yaml` and `.agent/scripts/verify-contract.sh`
9. `.agent/project.yaml`

Limit:

- this file is a portable repo-local aid, not proof that every runtime will honor custom agent definitions
