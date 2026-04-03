# Claude Role Integration

## Goal

Expose Kiwi Control specialist routing as repo-local role specs so Claude-style agents can align to the same contract even without machine-global Claude files.

## Repo-Local Role Surfaces

- `.agent/roles/README.md`
- `.agent/roles/backend-specialist.md`
- `.agent/roles/frontend-specialist.md`
- `.agent/roles/fullstack-specialist.md`
- `.agent/roles/python-specialist.md`
- `.agent/roles/data-platform-specialist.md`
- `.agent/roles/qa-specialist.md`
- `.agent/roles/docs-specialist.md`
- `.agent/roles/security-specialist.md`
- `.agent/roles/review-specialist.md`
- `.agent/roles/push-specialist.md`
- `.agent/roles/release-specialist.md`
- `.agent/roles/refactor-specialist.md`
- `.agent/roles/architecture-specialist.md`
- `.agent/roles/mcp-specialist.md`

## Role Contract Shape

Each specialist role file:

- declares `schema: shrey-junior/specialist-role@v1`
- identifies the specialist id and display name
- describes purpose, preferred tools, allowed profiles, routing bias, validation expectations, result schema expectations, MCP eligibility, risk posture, and handoff guidance
- explicitly states that repo authority outranks the role spec

## Packet Integration

Task packets now reference:

- `.agent/templates/role-result.md`
- `.agent/roles/<specialist>.md`
- `.github/agents/<specialist>.md`

This makes role-aware coordination file-based rather than dependent on hidden memory.

## Proven Behavior

- Bootstrap and standardize generate repo-local role specs.
- Task packets can reference role specs explicitly.
- Context compilation can read role markdown.

## Structurally Supported Behavior

- Claude-style agents that read repo files can follow the role contracts and continuity files.
- Repo-local role specs can substitute for machine-global subagent hints where repo visibility exists.

## Unproven Behavior

- Universal native support for repo-local role spec files across every Claude runtime
- Automatic subagent spawning based only on these files

## Practical Recommendation

Treat role specs as portable contracts and shared vocabulary, not as proof of runtime enforcement.
