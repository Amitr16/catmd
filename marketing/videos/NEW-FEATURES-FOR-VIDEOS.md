# New chat features for video — vc 67 / 2026-05-06

> **Purpose:** handoff to the marketing agent. Three new shippable
> features are in v0.1.10 / vc 67 that change what the chat is — and
> open three new viral video angles. Each can be made with the same
> production process as the existing 9-video series (Nano Banana →
> Hailuo → screen recording → CapCut).
>
> **Status:** features built and benchmarked. AAB built and ready to
> install. The marketing agent should schedule production once the
> founder has tested the features on a real cohort and confirms the
> proactive-memory behaviour is right.

---

## 1. What's actually new in the chat

The chat used to be: *"the cat replies in their own voice with
memory of the diary, family, and self-facts."*

It is now: **the cat knows EVERYTHING about itself — and surfaces
it unprompted.**

Three architectural shifts:

### 1.1 Comprehensive medical recall (READ side)

The cat now has structured access to:

| Tier | What it knows |
|---|---|
| **Profile** (was) | Name, breed, age, weight, sex, conditions, current medications |
| **Profile** (NEW) | DOB, age in months, adopted-on date, emergency vet contact, lifestyle |
| **Vaccinations** (NEW) | Last shot per vaccine, next due dates, OVERDUE flags |
| **Medication doses** (NEW) | Dose-by-dose adherence log, last 14 days, missed days |
| **Weight history** (NEW) | Last 5 measurements + 90-day trend (gaining / losing / stable + delta) |
| **Appointments** (NEW) | Next vet visit (date, time, vet, reason, days-until) + recently completed |
| **Pain scores** (NEW) | Recent Feline Grimace Scale composite scores |
| **Daily check-in streak** (NEW) | Consecutive days the human has logged in |
| **Reminders** (NEW) | Daily medication reminder time, weekly check-in time |

When the human asks anything, the cat answers from this in voice —
never flat ("4.5 kg") but always two beats ("4.5 kg. The number is on
file. For now.").

### 1.2 Proactive memory (the eerie / viral one)

The cat surfaces specifics UNPROMPTED — without being directly asked.

Examples:

- **User:** *"good morning"*
- **Cat:** *"Morning. The FVRCP is overdue, by the way. Just so we're clear who's noticing."*

- **User:** *"I love you, Lily."*
- **Cat:** *"Decent sentiment. I'm 300g heavier than 90 days ago. The kibble situation is working."*

- **User:** *"are you sick?"*
- **Cat:** *"No. But you skipped my 9 AM dose yesterday. The matter is logged."*

- **User:** *"what's up?"*
- **Cat:** *"Tuesday. The vet visit. I am not pleased."*

This is the screenshot moment. Owner sees their cat reference a
specific medical fact they themselves had forgotten — feels eerie,
funny, share-worthy.

### 1.3 Bidirectional gateway (WRITE side)

The chat is also the cat-data input surface. When the human is
explicit, the cat updates structured fields silently:

| User says | What happens (silent — no banner) |
|---|---|
| *"Lily weighs 4.5 kg now"* | profile.weight_kg → 4.5 + weight log entry added |
| *"She was born March 14, 2021"* | profile.dob_iso → 2021-03-14 |
| *"Lily had her FVRCP last Friday"* | vaccination event logged in healthStore |
| *"I gave her her pill at 9am"* | medication_dose event logged |
| *"Vet appointment next Tuesday at 3pm"* | appointment event logged |
| *"Set medicine reminder to 9am"* | daily 09:00 notification scheduled |

Hedge protection: *"around 4.5"* / *"I think Friday"* → cat replies in
voice but does NOT commit. Structured data only saves on explicit values.

---

## 2. Three new video concepts

These slot into the existing 9-video series as videos #10, #11, #12.
Same production process (Nano Banana stills + Hailuo clips + screen
recording in CapCut). Same 15-second hard cap.

The viral hook for all three is **the cat knowing something the human
forgot or didn't expect** — Co-Star "this app sees me too clearly"
energy applied to medical recall.

---

### 🟢 #10 — "She told ME her shot is overdue"

**Pillar:** Proactive memory / Health
**Hook:** *"my cat just told ME her FVRCP is overdue."*
**Format:** 15s vertical
**Single insight:** the cat surfaces health knowledge unprompted —
it's not a Q&A bot, it's a participant in its own care.

**Storyboard (4 beats):**

| Time | Visual | Audio | Text overlay |
|---|---|---|---|
| 0:00–0:03 | AI clip — cat sitting on a cat tower, looking past the camera, mildly disapproving | Soft ambient + light keyboard tap | *"i texted my cat 'good morning.'"* |
| 0:03–0:07 | Phone screen recording — user types "good morning" → cat reply lands: *"Morning. The FVRCP is overdue, by the way. Just so we're clear who's noticing."* | Notification chime on reply land | (the reply text fills the screen, large) |
| 0:07–0:10 | Cut to the human-stand-in (Nano Banana still + Hailuo) — woman blinking at phone, eyebrows up | Soft beat | *"my cat is reminding ME of the vet schedule???"* |
| 0:10–0:13 | Cat clip again — same cat, eyes narrowed slightly, smug | (silence) | *"she's been keeping notes."* |
| 0:13–0:15 | Brand card | Soft outro chord | *"**CatMD.**<br/>your cat keeps notes. you keep up.<br/>catmd.pet"* |

**Assets needed:**
- 1 cat AI clip (5s) — cat watching, mildly disapproving
- 1 human reaction AI clip (3s) — surprise → reading
- 1 screen recording — the chat exchange (must be a real CatMD install with an OVERDUE vaccination logged in Triage→Track for the proactive-mention to fire)
- 1 cat closer clip (3s) — same cat, smug

**Production note:** founder needs to seed the Triage→Track screen
with a vaccination event whose `next_due` is in the past (e.g. given
2024-11-01, due 2025-11-01). Then proactive memory fires on any
casual greeting. Founder confirms behaviour works on real install.

**Caption (organic):**
```
my cat just told me her FVRCP is overdue. CatMD —
your cat knows everything about herself, and isn't shy
about it.

#catmd #catsoftiktok #cathealth #cattalk #catmemory
```

**Caption (paid, post-Play-public):**
```
i texted my cat 'good morning' and she told me her shot is overdue.
CatMD — your cat reads her own medical record. Free to try.
```

---

### 🟢 #11 — "I told my cat she weighs 4.5 kg. she just… logged it."

**Pillar:** Bidirectional gateway / write side
**Hook:** *"told my cat her weight. she filed it."*
**Format:** 15s vertical
**Single insight:** the chat IS the data entry surface — and the cat's
voice carries it. No app forms.

**Storyboard (4 beats):**

| Time | Visual | Audio | Text overlay |
|---|---|---|---|
| 0:00–0:03 | AI clip — owner sitting next to cat, scale visible in frame, cat indifferent | Light foley — keyboard tap | *"i told my cat what she weighs."* |
| 0:03–0:07 | Phone screen recording — user types: "Lily weighs 4.5 kg now" → cat reply lands: *"Adequate. Logged."* | Single notification chime | (reply text large) |
| 0:07–0:10 | Cut to cat profile screen — weight field updates to "4.5 kg" — show it auto-flowing into the field, no banner, just the number arriving | Soft tick / file-saved sound | *"no banner. no app form. she just logged it."* |
| 0:10–0:13 | Cut back to user typing in chat: "what's my weight?" → cat: *"4.5 kg. The number is on file. For now."* | Soft beat | *"she even keeps her own receipts."* |
| 0:13–0:15 | Brand card | Soft outro chord | *"**CatMD.**<br/>tell your cat anything. she remembers.<br/>catmd.pet"* |

**Assets needed:**
- 1 cat + owner AI clip (3s) — sitting near each other, scale optional
- 2 screen recordings:
  - Chat exchange: typing weight + cat reply
  - Cat profile screen with weight field updating
  - Optional second chat: asking back "what's my weight?" + reply
- (No second cat clip needed — this video is more screen-heavy)

**Production note:** the WRITE happens silently in the production
build. To capture the receipt cleanly, screen-record both the chat
AND the cat-profile screen in sequence. CapCut splice.

**Caption (organic):**
```
i told my cat her weight. she just… logged it. no form,
no banner — she just files it. CatMD — chat is the cat,
and the cat is the data.

#catmd #catsoftiktok #catdata #aiforcats #cattalk
```

---

### 🟢 #12 — "She knows when you skipped her dose"

**Pillar:** Proactive memory / Adherence
**Hook:** *"i asked my cat if she's sick. she called me out instead."*
**Format:** 15s vertical
**Single insight:** cat tracks the human's behaviour too — your
medication adherence is part of her record. Eerie + slightly judgy.

**Storyboard (4 beats):**

| Time | Visual | Audio | Text overlay |
|---|---|---|---|
| 0:00–0:03 | AI clip — cat sitting in front of an empty pill bottle / med organiser, slightly affronted look | Single pill-bottle rattle SFX | *"i asked my cat if she's sick."* |
| 0:03–0:08 | Phone screen recording — user types "are you sick?" → cat reply: *"No. But you skipped my 9 AM dose yesterday. The matter is logged."* | Notification chime + beat lands hard on "logged" | (reply text large, "logged" emphasised) |
| 0:08–0:11 | Cut to user — Nano Banana / Hailuo clip — woman caught mid-thought, slightly busted | (silence — let it land) | *"oh. ok then."* |
| 0:11–0:13 | Cut back to cat — same cat, blink, unbothered | Soft beat | *"she's been keeping a tally."* |
| 0:13–0:15 | Brand card | Soft outro chord | *"**CatMD.**<br/>she sees the pill bottle. she sees you.<br/>catmd.pet"* |

**Assets needed:**
- 1 cat AI clip (3s) — cat near pill bottle, affronted
- 1 human reaction clip (3s) — caught
- 1 screen recording — the chat exchange
- 1 cat closer clip (2s) — same cat, blink

**Production note:** to trigger the proactive-mention of a missed
dose, the founder needs Triage→Track to have a medication-dose log
showing a gap (e.g. last dose 2 days ago when reminder is daily).
Otherwise the cat won't fire the "you skipped" line.

**Caveat for posting cadence:** save this for **after** video #10
lands. The "she's calling me out" beat is sharper if the audience
already trusts the cat's voice from prior videos. Don't lead with
this one.

**Caption (organic):**
```
i asked my cat if she's sick. she called me out for missing
her dose instead. CatMD — your cat keeps tabs on you too.

#catmd #catsoftiktok #catmemory #aiforcats #catattitude
```

---

## 3. Production cadence — how to slot these into the 9-video series

The current series order (per `marketing/videos/README.md`) is:

| # | Video | Status |
|---|---|---|
| 1 | Chat | 🟢 in production |
| 2 | Diary | Storyboard |
| 3 | Personality | Storyboard |
| 4 | Body Language | Storyboard |
| 5 | Daily Card | NEW |
| 6 | Cat Studio | NEW |
| 7 | Weekly Reading | NEW |
| 8 | People & Pets | NEW |
| 9 | Triage | NEW |

Adding the three new videos:

| # | Video | When in cadence |
|---|---|---|
| **10** | **She told ME her shot is overdue** | Drop AFTER #1 (Chat) lands — same chat-voice register, deepens the bet |
| **11** | **I told my cat her weight. she filed it.** | Drop in Week 3-4 — once audience knows the cat replies, show it also LISTENS |
| **12** | **She knows when you skipped her dose** | Drop Week 5+ — eerie variant, save for after audience trust is built |

Or — if the marketing agent is doing rapid iteration on Chat-related
content — these could be **re-cuts of #1's basic format with different
proactive-memory beats.** Same opening structure, different specific.
Tests TikTok algorithm response to the proactive-mention angle without
launching a new format.

---

## 4. Brand-card copy options for these videos

The current #1 brand card says *"Talk to your cat. catmd.pet"*

For these three, the brand card needs to reflect the new positioning.
Options:

- *"**CatMD.** Your cat keeps notes. You keep up. catmd.pet"*
- *"**CatMD.** She knows. She judges. catmd.pet"*
- *"**CatMD.** Tell your cat anything. She remembers. catmd.pet"*
- *"**CatMD.** Your cat. Your medical record. Their voice. catmd.pet"*
- *"**CatMD.** Your cat reads her own chart. catmd.pet"*

Pick per video — the playful ones for #10/#11, slightly sharper for
#12. The brand card image still uses Source Serif 4 + cream + sage
mark per `marketing/brand-guide.md`.

---

## 5. Why these are viral-worthy (the strategic frame)

The Co-Star pattern (per `marketing/chat-as-viral-lever.md`): the
share-worthy reply is one that makes the user feel SEEN. Co-Star did
this with horoscope reads. CatMD's chat replies were already in that
register — but they were limited to the cat's *attitude*. The new
features extend the "seen" feeling to the **medical record** — the
cat sees the user's adherence, the cat references the weight trend,
the cat reminds about the shot.

This widens the screenshot moments from "the cat said something
funny" → "the cat said something funny AND it knew a fact about me
I'd half-forgotten." Higher screenshot rate per chat session.

The bidirectional gateway (#11) is a different angle — it's the
"this app feels alive" moment. Most apps have forms; CatMD has the
cat. Telling the cat your weight and watching the profile silently
update is a small moment of magic.

---

## 6. Asset reusability across the new videos

| Asset | Used in |
|---|---|
| Same Lily reference photo | All 3 |
| Same human stand-in stills | #10, #12 |
| Pill-bottle prop / shot AI prop | #12 |
| Phone screen-recording rig | All 3 (just different chat exchanges) |
| Cat-profile screen recording | #11 only |
| Brand card template | All 3 (per brand-guide.md) |

Total expected fal.ai cost across the 3: ~$3-5 in Hailuo credits.
No new Nano Banana stills needed if the existing Lily + human stills
are reused; total cost stays under $5 across all 3.

---

## 7. What the founder needs to do BEFORE production starts

For the proactive-memory beats to actually fire on the screen
recordings, the founder's CatMD install must have:

- [ ] Real **vaccination event** logged with `next_due` in the past
      (for video #10's "FVRCP overdue" line)
- [ ] Real **medication-dose log** with at least one gap day
      (for video #12's "you skipped my 9 AM dose" line)
- [ ] Real **weight history** with at least 2 measurements 90+ days
      apart, showing a trend (for the "300g heavier" beat in optional
      video #11 variant)
- [ ] Real **vet appointment** scheduled in the next 7 days
      (for any "Tuesday. The vet visit." proactive lines)

Triage → Track is the surface to seed these. ~5 minutes of setup.
Once seeded, the proactive-memory rule fires on real chat replies
naturally — no test mode, no faked screens.

---

## 8. Source documents

- `marketing/videos/README.md` — master series plan (will be updated to
  reference this doc)
- `marketing/videos/PRODUCTION-PLAYBOOK.md` — end-to-end production
  process
- `marketing/brand-guide.md` — voice + visual rules
- `marketing/chat-as-viral-lever.md` — Co-Star analogy + share-card
  feature design
- `src/services/chat.ts` (lines ~1100-1500) — VOICE_RULES with PROACTIVE
  MEMORY section + LOG_EVENT marker grammar (the source-of-truth for
  what the cat will say)
- `src/services/catContext.ts` — render of all the data tiers the cat
  now knows about
- `docs/MARKET-ANALYSIS.md` — moonshot scenarios

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-06 | Initial draft. Three new video concepts (#10, #11, #12) for the new chat features in vc 67. Production-ready once founder seeds Triage→Track with realistic data for the proactive-memory beats. |
