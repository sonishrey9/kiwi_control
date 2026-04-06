<!-- SHREY-JUNIOR:FILE-START .agent/roles/review-specialist.md -->
---
schema: shrey-junior/specialist-role@v1
specialist_id: review-specialist
name: Review Specialist
generated_from: configs/specialists.yaml
portable: true
---

# Review Specialist

Canonical role spec for `review-specialist`.

## Purpose

General software engineering review for correctness, regression risk, contract safety, and change quality.

## Preferred Tools

claude, codex

## Allowed Profiles

strict-production, product-build, prototype, data-platform, documentation-heavy

## Routing Bias

### Roles
- reviewer

### Task Types
- review
- release-readiness
- bugfix
- refactor

### File Areas
- application
- tests
- config
- docs
- infra

## Validation Expectations

- separate findings from summary
- call out missing evidence or weak logic explicitly
- escalate unresolved contract or release risk conservatively

## Result Schema Expectations

- role
- status
- summary
- agreements
- conflicts
- validations
- risks
- next_steps

## MCP Eligibility

- context7
- filesystem
- github
- sequential-thinking

## Risk Posture

`conservative`

## Handoff Guidance

- use this specialist when generic review quality matters more than domain-specific depth

## Usage Notes

- treat this as a portable repo-local contract, not as stronger authority than explicit repo instructions
- use this role spec together with `.agent/state/active-role-hints.json`, `.agent/state/current-phase.json`, `.agent/memory/current-focus.json`, latest task packet, latest handoff, latest reconcile, `.agent/checks.yaml`, and `.agent/project.yaml`
- when handing off, leave evidence, open questions, next file, next command, and checkpoint pointer explicit
- if this role conflicts with explicit repo authority, repo authority wins
<!-- SHREY-JUNIOR:FILE-END .agent/roles/review-specialist.md -->
