# CatMD

**The AI vet that actually knows cats.** Triage-grade assistant for cat
parents: photo + symptom analysis, Ada-style differential diagnosis,
Supabase-backed feline knowledge corpus of 527 curated cards, and a
litter-box check mode tuned for the emergencies that kill cats fastest.

> Informational triage only — not veterinary advice.
> See [Medical Disclaimer](./docs/legal/medical-disclaimer.md).

---

## What's in this repo

```
app/                      Expo Router screens (onboarding, home, scan, result, ...)
src/
  ai/                     Guardrails, prompts, JSON-schema, triage orchestrator
  components/             Theme primitives, ScoreRing, UrgencyBadge, ...
  services/               Supabase, RAG, purchases, notifications, PDF
  state/                  Zustand stores (cats, scans, notifications)
  theme/                  Design-system tokens + haptics
knowledge-pipeline/       Python pipeline that builds the RAG corpus
  (see pipeline README)
proxy/                    Cloudflare Worker that fronts OpenAI securely
docs/
  design-system.md        Warm Clinical token spec
  ai-architecture.md      6-layer triage pipeline spec
  build-apk.md            How to ship a preview APK for dogfooding
  legal/                  Privacy Policy / Terms / Medical Disclaimer
scripts/generate_icons.py Regenerate the icon + splash set
assets/images/            Generated brand marks
eas.json                  Build profiles: development / preview / production
```

---

## Run locally (Expo Go — limited)

```powershell
cd D:\apps\catmd
npm install
cp .env.example .env        # then fill in the blanks
npx expo start --clear
```

Expo Go doesn't run the native modules (RevenueCat, some notifications,
Skia edge-cases). Use it for rapid UI iteration; for anything
native-bound, build a preview APK.

---

## Build a preview APK (the real testing path)

See [`docs/build-apk.md`](./docs/build-apk.md) for the 10-minute flow.
TL;DR:

```powershell
eas login
eas build --profile preview --platform android
# ~15-20 min, ends with a shareable APK URL
```

---

## Before your first production build

Three things need doing in order:

### 1. Deploy the AI proxy (10 min)

Stops your OpenAI key from shipping inside the APK.

```powershell
cd proxy
npm install
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Detailed walk-through: [`proxy/README.md`](./proxy/README.md).

### 2. Finalise legal docs

Drafts live in [`docs/legal/`](./docs/legal). Fill the placeholders
(company name, jurisdiction, email) and host them on any public HTTPS
URL. The Play Store listing requires a live Privacy Policy URL.

### 3. Supabase + RAG corpus

The knowledge pipeline has already populated the production Supabase
project. If you spin up a new project, see
[`knowledge-pipeline/README.md`](./knowledge-pipeline/README.md).

Also enable **Authentication → Providers → Anonymous** in the Supabase
dashboard, or the anonymous sign-in flow errors on bootstrap.

---

## Design + architecture docs

- [Design system](./docs/design-system.md) — Warm Clinical palette,
  Source Serif 4 / Figtree / JetBrains Mono type system, motion +
  haptic tokens, component specs.
- [AI architecture](./docs/ai-architecture.md) — 6-layer triage
  pipeline (guardrails → context → RAG → LLM → output filter →
  persist), differential-diagnosis schema, follow-up Q&A loop.
- [Knowledge pipeline spec](./docs/knowledge-pipeline-spec.md) — how
  the 527-card RAG corpus is built and refreshed.

---

## License + legal

- Code: private. Not open-sourced.
- Legal templates in `docs/legal/` are drafts only — customise and have
  a qualified lawyer review before production launch.
- "CatMD" is a project name pending formal IP registration.
