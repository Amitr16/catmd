# CatMD Privacy Policy

_Last updated: 2026-05-13_

This Privacy Policy explains how **CatMD** ("we", "us", "our") collects,
uses, and protects information when you use the CatMD mobile application
(the "App").

CatMD is an **informational app for cat owners**. It is **not** a
substitute for professional veterinary advice. See the
[Medical Disclaimer](./medical-disclaimer.md) and
[Terms of Service](./terms-of-service.md).

---

## 1. Summary in plain English

- **We collect as little as possible.** By default you use CatMD with an
  anonymous account — no email, no name, no real-world identity.
- **Your cat's profile, scans, diary, and chat history live on your
  device first.** We mirror them to our secure database so you can
  recover them if you change phones, but we never sell or share them.
- **Photos, videos, and audio you record** are sent to our AI processing
  partners to generate the response you asked for (scan result, body-
  language read, meow translation, chat reply, diary entry, postcard).
  We do not retain these on our servers beyond what's needed to show
  you the result and let you revisit it in your history.
- **Approximate location** (rounded to ~10 km) is used only to fetch
  local weather so your cat can reference real conditions in chat and
  diary. We never store precise coordinates.
- **AI-generated content.** Chat replies, diary entries, postcards,
  themed art, and meow translations are produced by AI. They are
  creative interpretations, not factual claims about your cat.
- **You can delete everything at any time.** The "Forget everything
  about my cat" button in Settings permanently erases your cats, scans,
  photos, audio, diary, and chat history from our servers and your
  device. You can also request deletion without the app at
  https://catmd.pet/delete-account.

---

## 2. Who we are

The App is operated by **Amit Raina** ("CatMD"), based in
**Singapore**. If you have privacy questions, email
**support@catmd.pet**.

---

## 3. What we collect and why

### 3.1 Data you provide directly

- **Cat profile:** name, breed (optional), date of birth / age (optional),
  weight (optional), sex, spay/neuter status, indoor/outdoor, known
  medical conditions, current medications, photo, free-text notes.
  _Why:_ so CatMD can tailor responses to your specific cat.
- **Scan inputs:** the text you type describing symptoms, photos, or
  videos you attach. _Why:_ to analyse the situation.
- **Body-language videos (~6 seconds):** short clips of your cat for
  posture and motion analysis. _Why:_ to generate a body-language read.
- **Meow audio recordings (~4–20 seconds):** short audio clips of your
  cat vocalising. _Why:_ to generate a meow translation.
- **Chat messages:** text you type to your cat. _Why:_ to generate the
  cat's reply.
- **Daily check-ins:** mood, appetite, water, litter, weight (all
  optional). _Why:_ to feed the diary and surface health trends.
- **Tagged photos:** photos with optional people / other-pet tags.
  _Why:_ so the cat can reference named family members + other pets.
- **Account email** (only if you choose to add one — anonymous use does
  not require an email). _Why:_ to let you recover your data on a new
  device and confirm Pro subscriptions. **No password is required** —
  we use one-time 6-digit codes ("OTP") sent to your email.

### 3.2 Data we generate for you

- **Scan / triage results:** observation summary, severity score, plain-
  language interpretation, suggested next steps. Stored with your scan.
- **Body-language reads:** structured observations (eyes, ears, tail,
  body, motion). Stored with the reading.
- **Meow translations:** AI-generated interpretation of the vocalisation
  paired with the audio + any optional photo.
- **Diary entries:** AI-written daily journal in your cat's voice,
  based on the day's activity.
- **Daily card / weekly reading / postcards / themed art:** AI-generated
  shareable content.
- **Chat replies:** AI-generated responses from your cat's perspective.
- **Memory items:** objects, places, named people, and pets the AI
  extracts from your photos and chat. The cat then references these by
  name to feel personalised.
- **Reminders:** if you enable a medication or check-in reminder, we
  schedule a local notification on your device. These are not sent
  through our servers.

### 3.3 Data we automatically receive

- **Anonymous account identifier** — a randomly generated user ID that
  lets the App persist your data without knowing who you are.
- **Approximate location** — when you grant location permission, we
  fetch your coarse coordinates (rounded to ~10 km, e.g. city-region
  level) **only** to retrieve local weather from Open-Meteo so your
  cat can reference real weather in chat and diary. We never store
  precise GPS coordinates. If you deny location permission, the App
  works exactly the same minus weather references.
- **Technical data:** app version, OS version, device model, crash
  reports, anonymised usage analytics (which screens you visit, which
  features you use). This helps us fix bugs and improve the App.
- **Purchase data:** if you subscribe to Pro, our subscription
  processor (RevenueCat) receives your anonymous user ID and the
  Google Play / Apple receipt. We do **not** receive or store your
  credit card or payment method — that stays with Google / Apple.

---

## 4. AI-generated content

CatMD uses generative AI to produce chat replies, diary entries, meow
translations, daily cards, postcards, themed art, and scan summaries.

- **Content is AI-generated, not authoritative.** Treat scan and body-
  language outputs as observations to discuss with a vet, never as a
  diagnosis. Treat chat / diary / postcard content as creative
  interpretation, not factual claims.
- **You can report problematic AI output.** If a generated response is
  inaccurate, offensive, or unsafe, email **support@catmd.pet** with
  the screenshot or the scan / chat ID. We review reports within 7
  days and update our prompts and guardrails accordingly.
- **No training on your data.** Our AI partners process your inputs in
  real time to return a result. We do not consent to your data being
  used to train their general-purpose models.

---

## 5. Who we share data with

We use the following processors. Each is contractually obliged to
handle your data for our purposes only.

| Processor | Purpose | Data shared |
|---|---|---|
| **Supabase, Inc.** | Hosting, database, authentication | Cat profile, scans, body-language reads, meow translations, diary, chat, account identifier, optional email |
| **OpenAI, LLC** | AI text + image + audio analysis (chat, diary, scan, body-language read, meow translation, postcard captions) | Your text, attached photos, attached videos, audio clips — sent at the moment of the request |
| **Open-Meteo** | Weather data | Coarse coordinates rounded to ~10 km, no identifier |
| **Cloudflare, Inc.** | Network / proxy | All API traffic (metadata only, not request bodies at rest) |
| **Sentry, Inc.** (if enabled) | Crash reporting | Crash reports with de-identified device info |
| **PostHog, Inc.** (if enabled) | Product analytics | Anonymous usage events |
| **RevenueCat, Inc.** (if you subscribe) | Subscription management | Anonymous user ID + Google Play / Apple purchase receipts |
| **Google LLC / Apple Inc.** | App store billing | Payment processed by Google Play Billing or Apple App Store — they receive your payment method, we never do |

We do **not** sell your personal data. We do **not** share your data
with advertisers.

---

## 6. How long we keep data

- **Cat profiles, scans, body-language reads, meow translations,
  diary entries, chat history, photos, audio:** kept until you delete
  them or your account.
- **Photos attached to scans / postcards / studio art:** kept with the
  record. Deleting the record deletes the file.
- **Audio recordings (meow translator):** kept with the translation
  record. Deleting the translation deletes the audio.
- **Videos (body-language):** kept with the reading record. Deleting
  the reading deletes the video.
- **Weather coordinates:** cached locally for 6 hours, never persisted
  server-side beyond that cache.
- **Anonymous analytics:** retained for 24 months maximum.
- **Crash reports:** retained for 90 days.

---

## 7. Your rights

Depending on your location, you have the right to:

- **Access** — export a copy of your data (email us).
- **Erasure** — delete everything. Use **Settings → Forget everything
  about my cat**, OR visit **https://catmd.pet/delete-account** to
  request deletion without the app, OR email **support@catmd.pet**.
- **Rectification** — correct inaccurate data (edit directly in-app or
  email us).
- **Portability** — receive your data in a machine-readable format.
- **Object / restrict** — opt out of analytics in Settings.
- **Withdraw consent** — stop using the App; data is not re-collected.
- **Lodge a complaint** with your national data protection authority.

We respond to rights requests within 30 days.

---

## 8. Children

CatMD is not intended for users under 13 (or under 16 in the EU /
UK / equivalent jurisdictions). We do not knowingly collect data from
children. If you believe a child has used CatMD, email us and we will
delete the associated data.

---

## 9. Security

- Data in transit is encrypted with TLS 1.2+.
- Data at rest in our database is encrypted (AES-256, managed by
  Supabase).
- Photos, videos, and audio you submit are sent over TLS to OpenAI for
  processing. OpenAI's processing policy is available at
  [openai.com/policies/api-data-usage-policies](https://openai.com/policies/api-data-usage-policies).
- You can run the App entirely anonymously. No identifier ties your
  scans to a real-world identity unless you add an email address.

No system is perfectly secure. If we become aware of a breach affecting
your data, we will notify you within 72 hours as required by law.

---

## 10. International transfers

Your data may be processed in the United States, the European Union, or
other locations where our processors operate. When we transfer data out
of the EU/UK, we rely on Standard Contractual Clauses or an adequacy
decision.

---

## 11. Changes to this policy

If we change this policy we will update the "Last updated" date above
and, for material changes, notify you in-app before the change takes
effect.

---

## 12. Contact

- **Privacy requests:** support@catmd.pet
- **Account deletion (without the app):** https://catmd.pet/delete-account
- **General support:** support@catmd.pet
- **Mailing address:** Available on request to support@catmd.pet
