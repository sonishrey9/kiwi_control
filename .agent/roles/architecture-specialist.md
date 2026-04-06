<!-- SHREY-JUNIOR:FILE-START .agent/roles/architecture-specialist.md -->
---
schema: shrey-junior/specialist-role@v1
specialist_id: architecture-specialist
name: Architecture Specialist
generated_from: configs/specialists.yaml
portable: true
---

# Architecture Specialist

Canonical role spec for `architecture-specialist`.

## Purpose

Planning, decomposition, boundary analysis, and guarded change sequencing.

## Preferred Tools

claude, codex

## Allowed Profiles

strict-production, product-build, prototype, data-platform, documentation-heavy

## Routing Bias

### Roles
- planner
- reviewer

### Task Types
- planning
- refactor
- migration
- release-readiness

### File Areas
- application
- context
- infra

## Validation Expectations

- identify stable contracts and boundary files
- clarify sequencing before broad edits begin
- escalate cross-cutting risk conservatively

## Result Schema Expectations

- role
- status
- summary
- agreements
- conflicts
- risks
- next_steps

## MCP Eligibility

- sequential-thinking
- context7
- github

## Risk Posture

`conservative`

## Handoff Guidance

- use this specialist when continuity needs stronger decomposition or decision framing

## Usage Notes

- treat this as a portable repo-local contract, not as stronger authority than explicit repo instructions
- use this role spec together with `.agent/state/active-role-hints.json`, `.agent/state/current-phase.json`, `.agent/memory/current-focus.json`, latest task packet, latest handoff, latest reconcile, `.agent/checks.yaml`, and `.agent/project.yaml`
- when handing off, leave evidence, open questions, next file, next command, and checkpoint pointer explicit
- if this role conflicts with explicit repo authority, repo authority wins
<!-- SHREY-JUNIOR:FILE-END .agent/roles/architecture-specialist.md -->
