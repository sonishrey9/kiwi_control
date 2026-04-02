# Skill Inventory

Machine inventory captured safely on 2026-04-02 using directory metadata and skill names only.

## Surfaces inspected

- Codex skills: `/Users/shreysoni/.codex/skills`
- Claude skills: `/Users/shreysoni/.claude/skills`
- Local agent skills: `/Users/shreysoni/.agents/skills`
- Claude rules: `/Users/shreysoni/.claude/rules`
- Codex rules: `/Users/shreysoni/.codex/rules`
- VS Code user prompts: `/Users/shreysoni/Library/Application Support/Code/User/prompts`

## Counts

- Codex skills: 147 directories
- Claude skills: 138 directories
- Local agent skills: 24 directories
- Claude rule groups: `common`, `python`
- Codex rules: `default.rules`
- VS Code user prompts: `aws-kiwi-profile.instructions.md`

## Strong coverage already present

### Python

- `python-patterns`
- `python-testing`
- `fastapi-patterns`
- `database-migrations`
- `django-*`
- `celery-patterns`
- `sqlalchemy-patterns`

### Web app / frontend

- `frontend-patterns`
- `e2e-testing`
- `playwright`
- `figma`
- `figma-implement-design`
- `frontend-slides`
- `chatgpt-apps`

### Backend / API

- `backend-patterns`
- `api-design`
- `deployment-patterns`
- `docker-patterns`
- `serverless-patterns`
- `postgres-patterns`
- `redis-patterns`

### QA / review / release

- `verification-loop`
- `security-review`
- `security-best-practices`
- `security-scan`
- `gh-fix-ci`
- `gh-address-comments`
- `e2e-testing`

### Architecture / planning / coordination

- `blueprint`
- `agentic-engineering`
- `autonomous-loops`
- `continuous-agent-loop`
- `dmux-workflows`
- `strategic-compact`
- `iterative-retrieval`

### Docs / communication

- `article-writing`
- `docs`-oriented update skills
- `prompt-optimizer`
- `notion-*`

## Shrey Junior integration status

Before this phase, Shrey Junior had a narrow specialist layer centered around:

- `python-specialist`
- `qa-specialist`
- `push-specialist`
- `security-specialist`
- `refactor-specialist`
- `docs-specialist`
- `architecture-specialist`
- `release-specialist`
- `mcp-specialist`

After hardening, Shrey Junior now formalizes the missing universal engineering specialists:

- `frontend-specialist`
- `backend-specialist`
- `fullstack-specialist`
- `review-specialist`

## Portable vs non-portable

- Codex and Claude skill directories are rich but machine-local
- Shrey Junior specialists are portable because they live in canonical repo config
- local agent skills under `~/.agents/skills` are useful reference material, but not automatically portable

## Gaps before hardening

- no first-class frontend specialist
- no first-class backend specialist
- no first-class fullstack specialist
- no general review specialist distinct from QA
- MCP capability model too narrow for the installed machine surface

## Remaining weak spots

- mobile-native specialist coverage is still indirect rather than explicit
- data-platform specialist behavior is still represented mainly through profiles plus backend/security/release specialists
- there is still no one-to-one bridge from machine-local skill names to Shrey Junior specialists; that remains an intentional abstraction layer
