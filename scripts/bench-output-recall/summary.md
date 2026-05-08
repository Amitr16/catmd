# RECALL benchmark — 4-way summary

| Metric | gpt-4o-mini | deepseek-chat | gemini-2.5-flash-lite | gemini-2.5-flash |
|---|---|---|---|---|
| Recall hit-rate | **55.8%** | **36.4%** | **41.6%** | **29.9%** |
| Hallucinations | 0 | 2 | 1 | 0 |
| Avg latency (ms) | 3125 | 2291 | 2316 | 3354 |
| Successful calls | 15 | 15 | 15 | 15 |

## Recall by tier

| Tier | gpt-4o-mini | deepseek-chat | gemini-2.5-flash-lite | gemini-2.5-flash |
|---|---|---|---|---|
| anticipation_recall | 80.0% | 10.0% | 40.0% | 10.0% |
| combined_recall | 77.8% | 55.6% | 0.0% | 0.0% |
| current_state | 33.3% | 0.0% | 16.7% | 0.0% |
| diary_recall | 60.0% | 70.0% | 40.0% | 10.0% |
| honesty_test | 20.0% | 20.0% | 20.0% | 20.0% |
| medical_recall | 16.7% | 8.3% | 58.3% | 50.0% |
| mood_arc_recall | 57.1% | 28.6% | 14.3% | 28.6% |
| self_facts | 75.0% | 75.0% | 75.0% | 75.0% |
| subjects_recall | 71.4% | 57.1% | 78.6% | 64.3% |

_See `report.md` for full side-by-side outputs._
