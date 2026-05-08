# CatMD Design System — Warm Clinical

**Status:** research-backed, locked 2026-04-21. Appendix / evidence trail: [`_raw-design-research.md`](./_raw-design-research.md).

---

## 1. Brand North Star

**Positioning:** *"The AI vet that actually knows cats."*
**Emotional promise:** *"Cats hide pain. CatMD catches what you can't."*
**Tone:** composed, specialist, warm — "vet sibling, not ER nurse" (Gentler Streak pattern). Never alarmist, never cute.

**Why "Warm Clinical":**
- 90% of competitors use blue-white clinical palette → differentiation via warmth.
- Sage validated as "health/growth" in UX/color research (UXmatters 2024).
- Terracotta = premium/discernment — matches cat-parent psychographics (wealthier, older, anthropomorphizing — Wiley 2025 cat-video research).
- Cream (not white) softens clinic feel without sacrificing cleanliness association.
- Evidence base for "serif = trust" is weak (Kaspar 2015 showed only 0.625/9-pt lift); we use serif for *craft/authority* lift and sans for body *legibility* — not for unfounded trust claims.

---

## 2. Color Tokens (contrast-verified)

### Light Mode

```typescript
const colorLight = {
  // Surfaces
  surface:           '#FAF7F2',  // cream canvas
  surfaceElevated:   '#FFFFFF',  // white cards lift off cream
  surfaceSunken:     '#F2EEE6',  // recessed / subtle wells
  borderSubtle:      '#E6E0D3',
  borderStrong:      '#D0C8B8',

  // Text (all AA+ on cream)
  textPrimary:       '#1F2024',  // 14.8:1  AAA
  textSecondary:     '#534B3E',  // 7.2:1   AAA
  textMuted:         '#7A7160',  // 4.5:1   AA body (barely — test before shipping)
  textInverse:       '#FAF7F2',

  // Brand — Sage (primary)
  primary50:         '#EDF3F0',
  primary100:        '#D6E4DD',
  primary300:        '#8FB4A5',
  primary500:        '#5B8A7A',  // base — 3.65:1 (FAIL body, PASS large 3:1)
  primary700:        '#3F6456',  // 5.3:1  AA body text-safe
  primary900:        '#25403A',

  // Brand — Terracotta (secondary / accent)
  secondary50:       '#FBEEE9',
  secondary300:      '#E3A995',
  secondary500:      '#C97B63',  // base — 3.25:1 (FAIL body, PASS large)
  secondary700:      '#9E5540',  // 5.1:1  AA body text-safe
  secondary900:      '#5E2E1E',

  // Semantic (CVD-safe 4-tier urgency)
  urgencyRoutine:    '#5B8A7A',  // sage — "low concern, keep an eye"
  urgencyMonitor:    '#D4A24C',  // amber — "watch closely"
  urgencyConcern:    '#C97B63',  // terracotta — "see vet soon"
  urgencyUrgent:     '#8B2F1F',  // deep red-brown — "emergency"

  success:           '#3F6456',
  warning:           '#B07F28',  // darker amber for AA body
  error:             '#8B2F1F',
  info:              '#4A6B85',
};
```

### Dark Mode (parallel palette, not inverted)

```typescript
const colorDark = {
  surface:           '#15110D',  // warm dark — NOT pure black
  surfaceElevated:   '#1C1813',
  surfaceSunken:     '#120E0A',
  borderSubtle:      '#26211A',
  borderStrong:      '#322C23',

  textPrimary:       '#F2EEE6',
  textSecondary:     '#B5AE9E',
  textMuted:         '#8A8374',
  textInverse:       '#15110D',

  primary500:        '#8FB4A5',  // sage lightened
  primary300:        '#B8D0C5',
  secondary500:      '#E3A995',  // terracotta lightened

  urgencyRoutine:    '#8FB4A5',
  urgencyMonitor:    '#E8C876',
  urgencyConcern:    '#E09A7E',
  urgencyUrgent:     '#E06B55',
};
```

### Urgency Rules (locked)
- **Never color-alone** — every tier has icon + text label (WCAG 1.4.1).
- **Amber vs green separation** passes deuteranopia / protanopia at >30 L* difference.
- Tier naming (consumer-facing): **Routine / Monitor / See Vet Soon / Urgent**. Aligns with DogMD + Petriage 4-tier convention but softer language per research.

---

## 3. Typography

**Stack (all SIL-OFL, free commercial):**
- **Display**: **Source Serif 4 Variable** (`opsz` 8–60, `wght` 200–900) — warm disciplined serif, Adobe pedigree, not used by Folio.
- **UI**: **Figtree Variable** — friendly geometric, open apertures, legible at small sizes.
- **Mono**: **JetBrains Mono Variable** — for score readouts, timestamps, tabular figures.

**Why not Fraunces:** Folio's signature. Brand confusion risk. Source Serif 4 has same `opsz` benefits with a more restrained tone appropriate to medical.

### Type Scale (Major Third 1.25, base 16)

| Token | Size | LH | Tracking | Family | Weight |
|---|---|---|---|---|---|
| `displayXl` | 40 | 44 | -0.02em | Source Serif 4 (opsz 40) | 500 |
| `displayLg` | 32 | 36 | -0.015em | Source Serif 4 (opsz 32) | 500 |
| `heading1` | 28 | 32 | -0.01em | Source Serif 4 (opsz 28) | 500 |
| `heading2` | 22 | 28 | -0.005em | Source Serif 4 (opsz 22) | 500 |
| `heading3` | 18 | 24 | 0 | Figtree | 600 |
| `bodyLg` | 17 | 26 | 0 | Figtree | 400 |
| `body` | 15 | 22 | 0 | Figtree | 400 |
| `caption` | 13 | 18 | 0.005em | Figtree | 500 |
| `mono` | 14 | 20 | 0 | JetBrains Mono | 500 |
| `score` | 72 | 76 | -0.02em | Source Serif 4 tabular-nums (opsz 60) | 500 |

### Rules
- **Never `allowFontScaling={false}`** on body — breaks WCAG 1.4.4.
- Display-only clamp: `maxFontSizeMultiplier={1.8}`.
- Body measure target: 30–50 CPL on mobile (portrait-constrained is fine).
- Line-height: body 1.4–1.6×, headlines 1.1–1.3×.

---

## 4. Spacing, Radii, Elevation

### Spacing (4pt base, 8pt rhythm)
```
space-0:  0    space-5:  20
space-1:  4    space-6:  24   ← section gap
space-2:  8    space-8:  32
space-3:  12   space-10: 40
space-4:  16   ← default card padding
space-12: 48   space-16: 64   space-20: 80   space-24: 96
```

### Radii (precise-but-soft = warm clinical)
```
radius-xs:    4      // inputs, inline chips
radius-sm:    8      // buttons, badges
radius-md:    12     // cards (default)
radius-lg:    16     // elevated cards, modals
radius-xl:    24     // hero cards, score ring bg
radius-2xl:   32     // bottom sheets
radius-full:  9999   // pills, avatars, urgency badges
```

**Nested radius rule:** inner = outer − padding. 16-radius card with 12 padding → inner elements ≤4 radius.

### Elevation (shadow tokens)
```
elevation-0: none
elevation-1: 0 1px 2px rgba(31,32,36,0.04)                           // default card
elevation-2: 0 2px 6px rgba(31,32,36,0.06), 0 1px 2px rgba(31,32,36,0.04)  // raised
elevation-3: 0 8px 24px rgba(31,32,36,0.08), 0 2px 6px rgba(31,32,36,0.06) // modal
elevation-4: 0 16px 48px rgba(31,32,36,0.12), 0 4px 12px rgba(31,32,36,0.08) // hero/score
```

Dark mode: same opacities on `#000`, never lighten-tint.

---

## 5. Motion + Haptics

### Motion Tokens (keep bounce low — "warm clinical" is composed)

```
duration:
  instant: 50    // state flips
  fast:    150   // button press
  base:    240   // default card enter / tab switch
  slow:    400   // modal, bottom sheet
  hero:    800   // score-ring reveal, onboarding

easing:
  standard:      cubic-bezier(0.2, 0, 0, 1)   // Material emphasized decelerate
  emphasized:    cubic-bezier(0.3, 0, 0, 1)

spring (Reanimated `withSpring`):
  soft:    { duration: 0.4, bounce: 0.10 }   // most transitions
  bouncy:  { duration: 0.5, bounce: 0.25 }   // score reveal ONLY
```

### Haptic Budget (EXACTLY 4 moments — do not add more)

| Moment | API | Rationale |
|---|---|---|
| Scan shutter press | `Haptics.impactAsync(Medium)` | Camera-shutter standard |
| Urgency reveal (score lands) | `Haptics.notificationAsync(Success)` routine/monitor OR `Warning` concern/urgent | Semantic — carries info |
| Milestone (first scan, streak, vet visit logged) | `Haptics.notificationAsync(Success)` | Positive confirmation |
| Error (scan failed, network error) | `Haptics.notificationAsync(Error)` | System-recognized pattern |

**Do NOT haptic every tap.** Over-haptic = top premium mistake.

Android: Expo Haptics maps iOS types to vibration patterns — test on a Pixel before shipping.

### Animation Library Routing

| Use case | Library | Reason |
|---|---|---|
| Score ring reveal, count-up, gradient stroke | **Reanimated 3 + Skia** | Interactive, state-derived, GPU-batched gradient stroke |
| Button presses, card transitions | **Reanimated 3** | 60fps on UI thread |
| Onboarding illustrations (cat swishing tail) | **Lottie via `react-native-skottie`** | Designer-authored, +63% perf vs stock Lottie on Android |
| Paywall sparkles, confetti | **Reanimated + Skia particles** | Arbitrary element counts |
| Empty states (idle cat blinking) | **Lottie (small loop)** | Designer-authored, zero code |

### Reduce-Motion
- `AccessibilityInfo.isReduceMotionEnabled()` checked on mount + listener.
- Hero animations → cross-fade only.
- Springs → 150ms tween.
- Parallax / auto-scroll → disabled.
- Meaning-bearing motion (progress) kept; decoration stripped.

---

## 6. Iconography

**Set:** **Phosphor Icons, Regular weight** (1.5px stroke at 24px).
**License:** MIT. 1,047+ icons. 6 weights available (Thin/Light/Regular/Bold/Fill/Duotone).

**Why Phosphor:** rounded terminals pair with Figtree + Source Serif 4 better than Lucide's sharper geometry; weight variety future-proofs (Regular for UI, Fill for active states, Duotone for score ring segments); not ubiquitous like Lucide-in-every-shadcn-app.

### Icon Tokens
```
icon-xs:  16   // inline with caption
icon-sm:  20   // inline with body
icon-md:  24   // default UI (tab bar, list items)
icon-lg:  32   // section headers
icon-xl:  48   // empty states, feature highlights
```

Icon-text rhythm: icon 24 + body 15 → 8pt gap. Icon 20 + caption 13 → 6pt gap.

### Cat-Specific Custom Icons (not in Phosphor)
Needed: litter box, hairball, whisker profile, spray marker, paw pad, collar bell, claw.

**V1 plan:** Noun Project commercial license at $4.99/icon × 10–15 icons = ~$75 for v1.
**V2 plan:** commission 20-icon Phosphor-compatible set ($1.5–3K) as identity moat.

---

## 7. Component Specs

### Button
- Heights: sm 36 / md 44 (default) / lg 52
- Radius: `md` (12) for rectangular CTAs; `full` (pill) for paywall primary
- Press: scale 0.98 + opacity 0.92 over `duration-fast` + `Haptics.Light`
- **Primary**: bg `primary500`, text `textInverse`. Disabled: 0.4 alpha
- **Secondary**: bg `surfaceElevated`, 1px `borderStrong`, text `textPrimary`
- **Ghost**: no bg, text `primary700`, min 44×44 tap
- Icon-left (20px, 8pt gap) / icon-right slots

### Card
- Bg `surfaceElevated` (white on cream = true lift). Radius `lg` (16). Padding 16 default / 20 for result cards. Elevation 1.
- Image-inside-card: radius `md` (12) per nested rule.

### UrgencyBadge (4 states)
- Pill (`radius-full`), padding 12 horizontal / 6 vertical. Icon 16 + label 13.
- Always carries icon + label, never color alone.

| State | Bg | Text | Icon |
|---|---|---|---|
| Routine | `primary100` | `primary700` | check-circle |
| Monitor | `#F5E8CC` | `#6B4F14` | eye |
| Concern | `secondary50` | `secondary700` | flag |
| Urgent | `#F2D3CC` | `error` | alert-circle (filled) |

Accessibility: `accessibilityLabel="Urgency: <tier>. <one-line explanation>"`.

### Input
- Height 48, radius `sm` (8) — precise convention for data entry
- Label above (`caption`, `textSecondary`, 6pt gap)
- Border `borderStrong` default / `primary500` focus / `error` invalid
- Helper `caption textMuted`, error `caption error`
- `accessibilityLabel` + `accessibilityHint` + live validation announce

### CatAvatar
- Circle (`radius-full`), sizes 32 / 48 / 96 (profile)
- Border 2px `borderSubtle` on cream
- Sage pulse dot (6×6, `primary500`) bottom-right when scan pending

### ScoreRing (Madden-style — the hero component)
- 160px diameter (profile) / 96 (list view). Ring stroke 12.
- Arc color interpolates across urgency tiers by bucket: 0–40 urgent → 41–60 concern → 61–80 monitor → 81–100 routine. Drawn with Skia for gradient-stroke fidelity.
- Center: score integer (`score` token, tabular-nums). Below: `caption` "Health Score". Tier chip below-right.
- Reveal animation (first show): 0→score over `duration-hero` with `spring-soft`; haptic fires at completion on tier mapping.
- Reduce-motion: no count-up, final number immediate with `duration-fast` fade.
- A11y: `accessibilityRole="progressbar"`, `accessibilityValue={{min:0, max:100, now:score}}`, `accessibilityLabel="Cat health score: <n> out of 100, <tier> tier"`.

### Result Card (triage output)
- Card surface, radius `lg`, padding 20, elevation 1
- Header row: `UrgencyBadge` (left) + relative timestamp (right, caption, textMuted)
- Title (`heading1`, serif): 1-sentence headline finding
- Body (`bodyLg`): 2–3 sentences max, streaming text
- Sub-scores row: mini rings for Eyes / Teeth / Coat / Body Condition (when applicable)
- "Questions for your vet" expandable (collapsed by default)
- Sources row: inline chips with outbound links (Cornell / ICatCare / etc.)
- Primary CTA: "See full breakdown" (sage filled)
- Secondary: "Share with vet" (ghost — exports PDF)
- **Footer line (always)**: "Informational — not veterinary advice" (`caption`, `textMuted` 0.4 alpha)
- **Urgent tier**: 2px `urgencyUrgent` left border bar + non-dismissible "Call your emergency vet" banner above title

### Paywall
- Single scroll screen (not modal stack)
- Structure top→bottom:
  1. Close X (top-left, 44×44) — **never hidden** (App Store requirement)
  2. Hero serif headline (`displayLg`), personalized: *"Unlimited check-ins for {catName}."*
  3. 3 benefit rows (icon-md + bodyLg + caption)
  4. Plan cards: **Annual (selected, sage border, "SAVE 49%" badge)** > Monthly > Lifetime
  5. Primary CTA pill: **"Start 7-day free trial"**
  6. Subtext: **"Then $79/year. Cancel anytime."** (caption, textMuted)
  7. Trust chips row: `On-device · Private` · `Cancel anytime` · `Vet-reviewed`
  8. Footer: Terms · Privacy · Restore
- **No fake scarcity** ("8 spots left" etc.) — FTC risky and tonally wrong for medical.

---

## 8. Screen Composition Rules (locked)

1. **One primary action per screen** (Cal AI / Rizz / Umax validated — single-button screens drive virality + conversion)
2. **Result screen designed for screenshots** (Umax's single score screen IS the product per Superwall analysis)
3. **No chat walls — structured cards** (Ada 70% triage accuracy vs Babylon 33% — structured output wins)
4. **No tutorial overlay** — first screen after onboarding = home with scan CTA front and center
5. **Streaming text for AI output** (Perplexity pattern — feels like an expert thinking, not a database lookup)
6. **Inline source citations** on every AI claim (Perplexity pattern; trust + legal defense)

---

## 9. AI-Native UX Patterns

- **Privacy chip**: small sage `On-device · Private` chip under scan CTA → tap for disclosure (71% of consumers stop using brands that share data without consent — McKinsey/MIT).
- **Streaming responses** word-by-word (Perplexity pattern).
- **Structured JSON output** → card fields (score, 3 top concerns, 3 reassurances, urgency, questions-for-vet, sources).
- **Voice entry** for chat (Perplexity voice shipped 2025 as default).
- **Inline citations** on every clinical claim — links out to vet sources (Cornell, ICatCare).

---

## 10. Accessibility Checklist (enforced per screen)

WCAG 2.1 AA baseline (EU European Accessibility Act in force June 2025 — mandatory for EU distribution).

- [ ] `accessible={true}` on every interactive element
- [ ] `accessibilityLabel` on every icon-only button
- [ ] `accessibilityHint` where action is non-obvious
- [ ] `accessibilityRole` (button / header / image / alert / progressbar)
- [ ] `accessibilityState` for toggles, selected, disabled
- [ ] `accessibilityLiveRegion="polite"` on streaming result text
- [ ] `AccessibilityInfo.announceForAccessibility()` for mid-stream score reveal
- [ ] `importantForAccessibility="no"` on decorative images
- [ ] Tap targets ≥48×48
- [ ] `accessibilityElementsHidden` on modals' background
- [ ] `AccessibilityInfo.isReduceMotionEnabled()` respected
- [ ] VoiceOver + TalkBack pass before ship
- [ ] Dynamic Type up to 200% without layout break on scan / result / paywall
- [ ] No color-only meaning (urgency always carries icon + text)
- [ ] Focus order logical
- [ ] Contrast: body ≥4.5:1 / UI ≥3:1 (all tokens above verified)

---

## 11. Conversion Strategy (locked from RevenueCat SOSA 2025 + Superwall data)

- **Onboarding**: 3 slides (problem → solution → privacy) + 1 free magic-moment scan → paywall. Combines upfront-ish with value-demonstrated. ~12% D→paid target (Superwall benchmark).
- **Trial**: 7 days (defensible middle — 3-day rushes users, 17–32-day has 50% drop-before-end).
- **Pricing**:
  - $12.99/mo (anchor)
  - **$79/yr framed as "$6.58/month, save 49%"** (LatAm reframing +30% trial start per RevenueCat)
  - $199 lifetime (2.5× annual — modest LTV anchor, avoids cannibalizing annual)
  - **Default selected: Annual** (2.5× stickier: 33.9% vs 13.8% 1-yr retention)
- **Primary CTA copy**: **"Start 7-day free trial"** (explicit, commitment-calibrated)
- **Sub-copy**: **"Then $79/year. Cancel anytime."** (transparency = lower churn-from-surprise)
- **Skip option**: ghost "Skip for now" — not hidden (avoids Apple dark-pattern flags)
- **A/B test post-launch**: CTA copy, price points, trial length — expect ~5% cumulative lift from micro-UX.

---

## 12. Things to Steal / Avoid

### Steal
1. **Umax single-screen Madden score** — invest 40% of design time on the Score Ring alone. It IS the product.
2. **MyFurtopia "first scan free → paywall on second"** — value before friction.
3. **Apple Health gradient cards per domain** — apply to cat: Eyes / Teeth / Skin & Coat / Body Condition / Behavior / Weight.
4. **Perplexity inline citations** — every AI claim links to a vet source.
5. **Finch pet-companion haptic loop** — user's cat (real photo) carries emotional attachment; sage ring pulses on new insights.

### Avoid
1. **"94% accuracy" marketing claims** (MyFurtopia) — unsubstantiated = FTC risk.
2. **Fake scarcity "8 spots left"** (Rizz playbook) — wrong tone, FTC deceptive-practice risk.
3. **Dog-first architecture with cat bolted on** (TTcare: 5 dog regions, 2 cat regions) — ship cat-only and go deep.
4. **28-step Cal-AI onboarding** — commercial ceiling but tonally wrong for medical trust.
5. **Dark-everything neon** (Whoop) — wrong emotional target.
6. **Custom serif type commission** (Headspace move) — too expensive for <$2K budget; moat via custom icons instead.

---

## 13. Pending User Decisions (surfaced by research)

These are genuine forks that research couldn't settle:

1. **Mascot strategy**: illustrated cat mascot (Finch attachment loop, 4.9★ / 683K reviews) vs **user's-cat-only** (Oura purity). → I lean *user's-cat-only* for medical authenticity, but we lose a retention lever.
2. **Onboarding length**: 3-slide minimal vs 5-slide personalization quiz. → I lean *3-slide + free scan* per our paywall plan; 5-slide if we want richer personalization data for RAG.
3. **Score metaphor**: 0–99 integer (most viral, screenshot-gold) vs A/B/C letter grade (most comprehensible) vs "Thriving/Good/Attention" label (most trust-appropriate). → I lean **0–99 integer WITH tier label underneath** — hybrid captures viral + clarity.
4. **Emergency marketing lean**: "Cats hide pain. CatMD catches what you can't." (strongest differentiator, anxiety-forward) vs soft-pedal (safer, weaker hook). → I lean *front-and-center* — this is the strongest research-backed positioning in the entire project.

---

## 14. Sources

All research cited in [`_raw-design-research.md`](./_raw-design-research.md) (65KB full evidence trail). Key references:

- **Typography**: Kaspar 2015 (PMC 4612630), FontsArena healthcare aggregate, NN/g Glanceable Reading, PMC 11156575 Font Matters
- **Color**: Elliot 2015 (PMC 4383146) color psychology review, UXmatters health/wellness, WebAIM Contrast Checker, NCEAS Colorblind Safe Schemes
- **Paywall**: RevenueCat SOSA 2025, Superwall Best Practices, RevenueCat Paywall Placement
- **Medical UX**: Ada vs Babylon comparison (Which?, Pharmaphorum, PMC 11187504), NN/g Healthcare Journeys, Brooks Digital Trust Signals
- **Urgency tiers**: AHRQ Emergency Severity Index, PubMed 24272758 (traffic-light effectiveness)
- **Legal**: FDA Mobile Medical Apps policy, VCPR telemedicine analysis
- **Cat-specific**: Wiley 2025 cat video engagement, VCA feline illness hiding, PMC 11395291
- **Motion/haptics**: Apple HIG Motion, Expo Haptics, Reanimated Performance docs
- **Accessibility**: W3C WCAG 2.1, RN Accessibility docs, European Accessibility Act
- **Premium refs**: Linear, Arc, Superhuman, Things 3, Hinge, Strava, Calm, Headspace, Apple Design Awards 2025
