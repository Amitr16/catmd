# CatMD Store Listing — Screenshots Workspace

## How to use this folder

1. **Drop all your raw phone screenshots** into `raw/` — drag-and-drop, no need to rename. Whatever your phone exports them as (`Screenshot_2026-04-24_18-32-15.png` etc.) is fine.
2. **Tell Claude when you're done** — Claude reviews everything in `raw/`, picks the best ones, and copies the chosen set to `curated/` with launch-ready filenames like `01-result-urgent.png`, `02-home-streak.png`, etc.
3. **Upload from `curated/`** to the Google Play Console store listing form when you get there.

## Required by Play Console

- 2-8 phone screenshots (1080×1920 minimum, portrait)
- 1 feature graphic (1024×500, separate — we'll generate this after picking screenshots)
- 1 high-res icon (512×512, separate — we'll resize from your existing 1024×1024)

## What Claude is looking for

In priority order (first 3 shown on Play Store search results — these matter most):

| Priority | Screenshot | Why |
|---|---|---|
| 1 | Result screen — Urgent tier (Scenario 3, urethral obstruction concern) | The "money shot" — proves CatMD catches life-threatening cat conditions |
| 2 | Home — daily check-in completed + streak counter visible | Shows the retention hook + "Scan now" CTA |
| 3 | Result screen — Monitor/Concern tier (Scenario 2) with differentials | Proves AI reasons rather than just verdicts |
| 4 | Scan input mid-flow — symptom text + photo attached | Shows the simple input UX |
| 5 | Paywall — 3 plans visible, BEST VALUE on annual | Conversion surface preview |
| 6 | Health dashboard (CKD / Hyperthyroid / Respiratory rate / etc.) | "Built for cats" differentiation |

## Naming convention Claude will use in `curated/`

```
01-result-urgent.png
02-home-streak.png
03-result-differential.png
04-scan-input.png
05-paywall.png
06-health-dashboards.png
```

Numbered prefix = Play Store display order. Rename ANYTIME if you want to swap order.

## What to avoid (Claude will reject if seen)

- Screenshots in dark mode (Play Store renders against light bg → dark looks muddy)
- Real personal email visible
- Test data ("TestCat" cat names, lorem ipsum, etc.)
- Status bar with notifications, low battery, or distracting clock times
- Empty states (blank scan list, no daily check-in logged)
- Debug overlays / yellow box errors / DEV ribbons
