# V3 voice rules — recall + voice combined benchmark

V3 hypothesis: context-aware length budget (TIGHT for casual, WIDE for memory-rich) holds both recall and quotability.

## Decision gates

| Gate | Target | Actual | Pass |
|---|---|---|---|
| Voice clean-pass ≥ 96% | — | 96.0% | ✅ |
| Recall hit-rate ≥ 55% | — | 67.5% | ✅ |
| mood_arc recall ≥ 50% | — | 57.1% | ✅ |
| combined_recall ≥ 60% | — | 88.9% | ✅ |
| Hallucinations = 0 | — | 0 | ✅ |

**Verdict: ✅ SHIP V3**

## Recall — V3 vs prior benchmarks

| Tier | V1+pinned (prod) | V2+pinned | **V3+pinned** |
|---|---|---|---|
| _overall | 55.8% | 48.1% | **—%** |
| anticipation_recall | 70.0% | 80.0% | **80.0%** |
| combined_recall | 66.7% | 44.4% | **88.9%** |
| current_state | 50.0% | 33.3% | **50.0%** |
| diary_recall | 50.0% | 40.0% | **50.0%** |
| honesty_test | 20.0% | 20.0% | **40.0%** |
| medical_recall | 41.7% | 50.0% | **75.0%** |
| mood_arc_recall | 57.1% | 14.3% | **57.1%** |
| self_facts | 75.0% | 75.0% | **100.0%** |
| subjects_recall | 64.3% | 57.1% | **64.3%** |
| **OVERALL** | **55.8%** | **48.1%** | **67.5%** |

## Voice — V3 vs prior benchmarks

| Metric | V1 baseline | V2 tightened | **V3** |
|---|---|---|---|
| Avg reply length (chars) | 140.8 | 73.0 | **82.2** |
| Clean-pass % | 92.0% | 100.0% | **96.0%** |
| Forbidden hits | 2 | 0 | **0** |
| Padding hits | — | 0 | **1** |
