# Contributing

## Principles

- keep the repo-first contract authoritative
- keep generic repos quiet
- prefer additive changes over rewrites
- avoid widening claims about runtime support
- do not add destructive automation

## Local workflow

```bash
npm install
npm run build
npm test
bash scripts/smoke-test.sh
```

## Architecture rules

- canonical truth stays in `configs/`, `prompts/`, and `templates/`
- `sj-core` owns business logic
- `sj-cli` stays thin
- `sj-ui` must not become authoritative
- repo-local artifacts remain portable source of truth

## Pull requests

Please include:

- the problem being solved
- any repo contract surface changed
- any portability or runtime-assumption change
- verification results
- any remaining limits or follow-up work

## Release-related changes

If you touch packaging, signing, updater metadata, or release automation, document:

- what became more real
- what is still placeholder-only
- what platforms were actually exercised
