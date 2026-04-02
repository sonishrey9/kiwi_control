# Structured Role Result Template

Use this template for planner / implementer / reviewer / tester outputs when the repo uses Shrey Junior coordination.

Preferred format:

```md
---
schema: shrey-junior/role-result@v1
role: planner
status: complete
summary: Short outcome summary.
agreements:
  - agreement item
conflicts:
  - conflict item
validations:
  - validation run or validation gap
risks:
  - unresolved risk
touched_files:
  - src/example.ts
next_steps:
  - concrete next action
---
```

Minimum fields:

- `role`
- `status`
- `summary`
- `agreements`
- `conflicts`
- `validations`
- `risks`
- `touched_files`
- `next_steps`

Status values:

- `pending`
- `active`
- `complete`
- `blocked`

Guidance:

- prefer structured frontmatter or JSON over loose markdown
- if you fall back to plain markdown, use explicit tags like `agreement:`, `conflict:`, `validation:`, `risk:`, `touched_file:`, and `next_step:`
- do not assume missing fields mean approval
