<!-- SHREY-JUNIOR:FILE-START .agent/roles/backend-specialist.md -->
---
schema: shrey-junior/specialist-role@v1
specialist_id: backend-specialist
name: Backend Specialist
generated_from: configs/specialists.yaml
portable: true
---

# Backend Specialist

Canonical role spec for `backend-specialist`.

## Purpose

API, service, persistence, and contract-safe backend delivery across Python, Node, and general server-side repos.

## Preferred Tools

codex, claude

## Allowed Profiles

strict-production, product-build, prototype, data-platform

## Routing Bias

### Roles
- implementer
- reviewer

### Task Types
- implementation
- bugfix
- refactor
- migration

### File Areas
- application
- infra
- tests

## Validation Expectations

- verify interface or contract changes explicitly
- run the narrowest backend or API validation available
- call out data, auth, or migration side effects

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
- docker
- supabase

## Risk Posture

`medium`

## Handoff Guidance

- hand off stable contracts and validation evidence early
- escalate to security-specialist for auth, exposure, or permission-sensitive work

## Usage Notes

- treat this as a portable repo-local contract, not as stronger authority than explicit repo instructions
- use this role spec together with `.agent/state/active-role-hints.json`, `.agent/state/current-phase.json`, `.agent/memory/current-focus.json`, latest task packet, latest handoff, latest reconcile, `.agent/checks.yaml`, and `.agent/project.yaml`
- when handing off, leave evidence, open questions, next file, next command, and checkpoint pointer explicit
- if this role conflicts with explicit repo authority, repo authority wins
<!-- SHREY-JUNIOR:FILE-END .agent/roles/backend-specialist.md -->
