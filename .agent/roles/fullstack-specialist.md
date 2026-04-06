<!-- SHREY-JUNIOR:FILE-START .agent/roles/fullstack-specialist.md -->
---
schema: shrey-junior/specialist-role@v1
specialist_id: fullstack-specialist
name: Fullstack Specialist
generated_from: configs/specialists.yaml
portable: true
---

# Fullstack Specialist

Canonical role spec for `fullstack-specialist`.

## Purpose

Balanced implementation specialist for app and web repos that cross frontend, backend, routing, and validation boundaries.

## Preferred Tools

codex, claude, copilot

## Allowed Profiles

strict-production, product-build, prototype, documentation-heavy

## Routing Bias

### Roles
- implementer
- planner

### Task Types
- implementation
- bugfix
- refactor

### File Areas
- application
- tests
- docs
- config

## Validation Expectations

- identify touched boundary files before editing
- run at least one implementation validation and one review-oriented validation
- split reviewer or tester work when contracts or cross-cutting changes appear

## Result Schema Expectations

- role
- status
- summary
- agreements
- validations
- risks
- touched_files
- next_steps

## MCP Eligibility

- context7
- filesystem
- github
- playwright
- docker

## Risk Posture

`medium`

## Handoff Guidance

- hand off browser evidence and backend validation together for guarded follow-through

## Usage Notes

- treat this as a portable repo-local contract, not as stronger authority than explicit repo instructions
- use this role spec together with `.agent/state/active-role-hints.json`, `.agent/state/current-phase.json`, `.agent/memory/current-focus.json`, latest task packet, latest handoff, latest reconcile, `.agent/checks.yaml`, and `.agent/project.yaml`
- when handing off, leave evidence, open questions, next file, next command, and checkpoint pointer explicit
- if this role conflicts with explicit repo authority, repo authority wins
<!-- SHREY-JUNIOR:FILE-END .agent/roles/fullstack-specialist.md -->
