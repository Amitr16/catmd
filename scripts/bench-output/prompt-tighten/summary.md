# Prompt-tightening A/B — summary

| Metric | gpt-4o-mini × V1 (baseline) | gpt-4o-mini × V2 (tightened) | gpt-4o × V1 (target) |
|---|---|---|---|
| Successful calls | 25 | 25 | 25 |
| Avg reply length (chars) | 140.8 | 73.0 | 94.6 |
| Avg latency (ms) | 2478 | 2137 | 1890 |
| Soft-opener slips | 0 | 0 | 0 |
| Forbidden-phrase hits | 2 | 0 | 1 |
| Padding-phrase hits | 0 | 0 | 0 |
| Clean-pass count | 23 | 25 | 24 |
| Clean-pass % | 92.0% | 100.0% | 96.0% |
| Avg input tokens / turn | 1255.8 | 1631.8 | 1255.8 |
| Avg output tokens / turn | 32.7 | 17.6 | 21.2 |
| Cost per 1K turns (USD) | $0.208 | $0.255 | $3.352 |

_See `report.md` for full side-by-side outputs._
