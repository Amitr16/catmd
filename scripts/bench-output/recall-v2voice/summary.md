# V1 voice + pinned vs V2 voice + pinned — recall A/B

Same 15 recall-heavy prompts. Same pinned-facts mechanism. Only difference: voice rules.

| Metric | V1 voice + pinned | V2 voice + pinned | Δ |
|---|---|---|---|
| **Recall hit-rate** | 55.8% | **48.1%** | **-7.7** |
| Avg reply length (chars) | 258.9 | 115.3 | -143.6 |
| Hallucinations | 0 | 1 | — |

## Recall by tier

| Tier | V1+pinned | V2+pinned | Δ |
|---|---|---|---|
| anticipation_recall | 70.0% | 80.0% | **+10.0** |
| combined_recall | 66.7% | 44.4% | **-22.3** |
| current_state | 50.0% | 33.3% | **-16.7** |
| diary_recall | 50.0% | 40.0% | **-10.0** |
| honesty_test | 20.0% | 20.0% | **+0.0** |
| medical_recall | 41.7% | 50.0% | **+8.3** |
| mood_arc_recall | 57.1% | 14.3% | **-42.8** |
| self_facts | 75.0% | 75.0% | **+0.0** |
| subjects_recall | 64.3% | 57.1% | **-7.2** |
