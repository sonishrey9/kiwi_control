---
schema: shrey-junior/specialist-role@v1
specialist_id: {{specialistId}}
name: {{specialistName}}
generated_from: configs/specialists.yaml
portable: true
---

# {{specialistName}}

Canonical role spec for `{{specialistId}}`.

## Purpose

{{specialistPurpose}}

## Preferred Tools

{{specialistPreferredTools}}

## Allowed Profiles

{{specialistAllowedProfiles}}

## Routing Bias

### Roles
{{specialistRoutingRoles}}

### Task Types
{{specialistRoutingTaskTypes}}

### File Areas
{{specialistRoutingFileAreas}}

## Validation Expectations

{{specialistValidationExpectations}}

## Result Schema Expectations

{{specialistResultSchema}}

## MCP Eligibility

{{specialistMcpEligibility}}

## Risk Posture

`{{specialistRiskPosture}}`

## Handoff Guidance

{{specialistHandoffGuidance}}

## Usage Notes

- treat this as a portable repo-local contract, not as stronger authority than explicit repo instructions
- use this role spec together with `.agent/state/active-role-hints.json`, current phase state, latest task packet, latest handoff, latest reconcile, `.agent/checks.yaml`, and `.agent/project.yaml`
- if this role conflicts with explicit repo authority, repo authority wins
