# Proof Summary

## Source Repos

- Repo A without Kiwi workflow help: `/Volumes/shrey ssd/my ssd-playground/test-A`
- Repo B with Kiwi workflow help: `/Volumes/shrey ssd/my ssd-playground/test-B`

## Task

Markdown Notes Organizer:

- create note
- edit note
- delete note
- tag note
- filter by tag
- search by title/content
- localStorage persistence
- stats header
- tests for core store logic

## Measured Values

| Metric | Repo A | Repo B |
|---|---:|---:|
| Claude invocations | 3 | 2 |
| Claude turns | 37 | 28 |
| Claude cost (USD) | 1.386074 | 0.869697 |
| Output tokens | 27974 | 10958 |
| Cache read tokens | 1301005 | 1100949 |
| Cache creation tokens | 153617 | 99989 |
| Claude wall-clock seconds | 432 | 177 |

## Headline Captions

- 37.3% lower Claude cost
- 24.3% fewer Claude turns
- 59.0% lower Claude wall-clock time

## Required Caution

Measured on one controlled greenfield A/B run of the same task using direct Claude JSON usage data. This is useful proof for this run, not a universal benchmark.

## Evidence Links

- Public proof page: https://kiwi-control.kiwi-ai.in/proof/
- Comparison report: `docs/proof/ab-run-2026-04-15/comparison-report.md`
- Comparison summary JSON: `docs/proof/ab-run-2026-04-15/comparison-summary.json`
- Repo A metrics: `docs/proof/ab-run-2026-04-15/repo-a-metrics.json`
- Repo B metrics: `docs/proof/ab-run-2026-04-15/repo-b-metrics.json`
- Repo B Kiwi outputs: `docs/proof/ab-run-2026-04-15/raw/kc-*.json`
