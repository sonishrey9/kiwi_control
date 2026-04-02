# Claude To Codex

1. Start with a planning or review-heavy packet where Claude is the primary tool.
2. Once the plan is accepted, record a checkpoint:

```bash
node dist/cli.js checkpoint "planning approved" --target "/path/to/repo" --tool claude --profile strict-production --status complete --validations "architecture review" --next "handoff to codex for implementation"
```

3. Generate a Codex handoff:

```bash
node dist/cli.js handoff --target "/path/to/repo" --to codex
```

4. Codex can continue from the brief and the latest packets without needing the full previous session.
