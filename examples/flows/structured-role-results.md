# Structured Role Results

Use structured role results when multiple tools or humans are contributing to one dispatch.

1. Run `dispatch` to create the manifest and role assignments.
2. Write one result file per role under `.agent/state/dispatch/<dispatch-id>/results/`.
3. Prefer JSON or markdown frontmatter so `collect` and `reconcile` can trust the output.
4. Run `collect`.
5. Run `reconcile`.

## Minimal reviewer JSON

```json
{
  "role": "reviewer",
  "status": "complete",
  "summary": "Review completed with one follow-up note.",
  "agreements": ["The change stays inside repo-local control files."],
  "conflicts": [],
  "validations": ["manual diff review"],
  "risks": ["Need one final smoke check."],
  "touched_files": ["src/commands/collect.ts"],
  "next_steps": ["Ask tester to confirm smoke coverage."]
}
```

## Minimal tester markdown

```md
---
role: tester
status: complete
summary: Smoke test passed locally.
agreements:
  - Structured role results parse correctly.
conflicts: []
validations:
  - npm test
risks: []
touched_files:
  - src/tests/collect.test.ts
next_steps:
  - checkpoint if reviewer agrees
---
```

If a role only writes loose markdown, Shrey Junior still collects it, but the final reconcile report will say that it relied on heuristic fallback.
