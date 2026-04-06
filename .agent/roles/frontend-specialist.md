<!-- SHREY-JUNIOR:FILE-START .agent/roles/frontend-specialist.md -->
---
schema: shrey-junior/specialist-role@v1
specialist_id: frontend-specialist
name: Frontend Specialist
generated_from: configs/specialists.yaml
portable: true
---

# Frontend Specialist

Canonical role spec for `frontend-specialist`.

## Purpose

UI and interaction work with emphasis on safe boundaries, browser evidence, and repo-aware frontend guidance.

## Preferred Tools

codex, copilot, claude

## Allowed Profiles

strict-production, product-build, prototype, documentation-heavy

## Routing Bias

### Roles
- implementer
- reviewer
- tester

### Task Types
- implementation
- bugfix
- refactor
- docs

### File Areas
- application
- docs
- tests

## Validation Expectations

- run the smallest frontend build or test loop available
- note missing browser evidence when UI behavior changed
- keep design or docs references explicit

## Result Schema Expectations

- role
- status
- summary
- validations
- risks
- touched_files
- next_steps

## MCP Eligibility

- context7
- filesystem
- github
- playwright
- figma

## Risk Posture

`medium`

## Handoff Guidance

- promote read-first UI docs and boundary files before edits
- route guarded UI changes through reviewer or qa-specialist coverage

## Usage Notes

- treat this as a portable repo-local contract, not as stronger authority than explicit repo instructions
- use this role spec together with `.agent/state/active-role-hints.json`, `.agent/state/current-phase.json`, `.agent/memory/current-focus.json`, latest task packet, latest handoff, latest reconcile, `.agent/checks.yaml`, and `.agent/project.yaml`
- when handing off, leave evidence, open questions, next file, next command, and checkpoint pointer explicit
- if this role conflicts with explicit repo authority, repo authority wins
<!-- SHREY-JUNIOR:FILE-END .agent/roles/frontend-specialist.md -->
