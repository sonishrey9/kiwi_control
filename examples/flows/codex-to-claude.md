# Codex To Claude

1. Use `run` or `fanout` to generate the initial packet set for Codex-led implementation.
2. After Codex finishes the implementation phase, record a checkpoint:

```bash
node dist/cli.js checkpoint "implementation complete" --target "/path/to/repo" --tool codex --profile product-build --validations "npm test" --next "handoff to claude for guarded review"
```

3. Generate a Claude handoff:

```bash
node dist/cli.js handoff --target "/path/to/repo" --to claude
```

4. Claude starts by reading:

- `.agent/state/current-phase.json`
- the newest `.agent/state/handoff/*-to-claude.brief.md`
- the authority files listed in the handoff

5. If Claude adds review findings, record a new checkpoint before the next phase.
