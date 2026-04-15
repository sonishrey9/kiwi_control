# A/B Comparison: Markdown Notes Organizer

This comparison uses direct Claude JSON usage data where available, plus proxy engineering metrics.

## Summary Table

| Metric | Repo A | Repo B |
|---|---:|---:|
| Claude invocations | 3 | 2 |
| Claude turns | 37 | 28 |
| Claude cost (USD) | 1.386074 | 0.869697 |
| Input tokens | 33 | 28 |
| Output tokens | 27974 | 10958 |
| Cache read tokens | 1301005 | 1100949 |
| Cache creation tokens | 153617 | 99989 |
| Claude wall-clock seconds | 432 | 177 |
| Shell command logs captured | 22 | 20 |
| Non-git/non-node_modules files present | 65 | 132 |
| Product file count | 13 | 12 |
| Kiwi JSON outputs captured | 0 | 9 |
| Tests pass | yes | yes |
| Build passes | yes | yes |

## Observations

- A Claude invocations: 3; B Claude invocations: 2
- A wall-clock Claude time: 432s; B wall-clock Claude time: 177s
- A total cost: $1.386074; B total cost: $0.869697
- A total turns: 37; B total turns: 28
- A total input/output tokens: 33/27974; B total input/output tokens: 28/10958
- B used Kiwi Control pre-implementation surfaces; A did not.

## Repo A Notes

- Repo A used Claude Code directly with no Kiwi pre-implementation workflow help.
- Repo A required two Claude repair passes after the initial implementation.

## Repo B Notes

- Repo B was Kiwi-initialized before implementation and captured status, guide, graph, pack, and review outputs first.
- Repo B required one Claude repair pass after the initial implementation.

## Honesty Note

- `ccusage` was not installed, so this report uses Claude JSON output directly instead of ccusage.
- No token savings percentage is claimed.
