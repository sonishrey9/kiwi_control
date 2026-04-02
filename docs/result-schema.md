# Structured Role Result Schema

`dispatch`, `collect`, and `reconcile` work best when each role writes a structured result file under:

- `.agent/state/dispatch/<dispatch-id>/results/planner.json`
- `.agent/state/dispatch/<dispatch-id>/results/implementer.json`
- `.agent/state/dispatch/<dispatch-id>/results/reviewer.md`
- `.agent/state/dispatch/<dispatch-id>/results/tester.md`

Two formats are supported:

1. JSON
2. Markdown with YAML frontmatter

Legacy loose markdown still works, but `collect` and `reconcile` will mark it as heuristic fallback.

## Preferred fields

Core fields:

- `role`
- `status`
- `summary`

Strongly recommended fields:

- `agreements`
- `conflicts`
- `validations`
- `risks`
- `touched_files`
- `next_steps`

When recommended fields are missing, `collect` records the role as partial and `reconcile` will say the result relied on incomplete structured output.

## JSON example

```json
{
  "role": "reviewer",
  "status": "complete",
  "summary": "Reviewer agrees with the bounded refactor.",
  "agreements": ["No public API changes are needed."],
  "conflicts": [],
  "validations": ["npm test", "manual diff review"],
  "risks": ["Follow-up load test still pending."],
  "touched_files": ["src/core/router.ts", "src/commands/status.ts"],
  "next_steps": ["Ask tester to confirm packet output."]
}
```

## Markdown with frontmatter example

```md
---
role: tester
status: complete
summary: Smoke checks passed for the coordination flow.
agreements:
  - Dispatch and collect stayed repo-local.
conflicts: []
validations:
  - npm test
risks:
  - Full repo integration test still pending.
touched_files:
  - src/core/dispatch.ts
next_steps:
  - Record a checkpoint if reviewer agrees.
---

Optional body notes can follow here.
```

## Legacy fallback example

```md
# Reviewer
agreement: keep stable contracts
validation: manual review
risk: follow up on packet verbosity
next_step: ask tester to confirm
```

This still works, but Shrey Junior will explicitly report that the result used heuristic parsing.
