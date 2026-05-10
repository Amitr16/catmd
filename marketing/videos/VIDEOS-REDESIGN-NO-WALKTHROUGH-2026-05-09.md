# Videos #4–#17 — Redesigned for Zero App Walkthrough

> **Drafted:** 2026-05-09
> **Reason:** Founder constraint — screen-recording-of-app sequences are eating production time and require app-state setup (vaccines overdue, dose logs, 7pm push timing, etc.). Redesigning to a leaner production pattern: AI cat clips + typography reveals + brand cards. No phone access required.

---

## The new pattern

Every video #4–#17 follows this 4-act structure:

```
ACT 1 (~3s)  — AI cat clip — atmospheric hook
ACT 2 (~6-8s) — Typography reveal — the cat's voice as cinematic on-screen text
                (Source Serif 4 italic, cream background or as overlay on AI clip)
ACT 3 (~4-6s) — AI clip variant — emotional/reaction beat
ACT 4 (~3-4s) — Brand card — closing
```

The typography reveal replaces the app screen recording. It looks like a Co-Star card or an editorial pull-quote — visually stronger AND on-brand than a UI screenshot would be. It's also reproducible as a CapCut template once and swappable per video.

**Total length per video: 15–22 seconds.**

**Production cost per video: ~$2-4 fal.ai credits** (3 AI clips + brand card stills). No app interaction required.

---

## CapCut typography template (build once, reuse for all 14 videos)

Set up a single reusable CapCut template:
- Background: cream `#FAF7F2` OR semi-transparent cream over the AI clip (60-80% opacity)
- Font: Source Serif 4 italic for cat voice; regular for narration/captions
- Color: charcoal `#1F2024`
- Width: ~70% of screen, centered horizontally
- Position: center vertical OR lower-third per beat
- Animation: text fades in line-by-line (0.4s per line), 1-1.5s pause between lines, fade out at end of beat
- Optional: subtle terracotta accent line above key phrases

This template renders Co-Star-card aesthetic. Swap the text per video. Keep everything else identical for series consistency.

---

## Reusable Nano Banana brand-card prompt (template)

Use this template for every video's closing brand card. Swap `[VIDEO-SPECIFIC TAGLINE]`:

```
A minimalist 9:16 vertical card. Cream background (#FAF7F2). At
the top center, a small dark sage circular icon (cat silhouette
in a sage circle). Below the icon, in elegant Source Serif 4
typography, the words "CatMD" in sage dark green (#3F6456). Below
that: "[VIDEO-SPECIFIC TAGLINE]". Below that, smaller: "catmd.pet".
Centered, generous whitespace, luxurious editorial feel.
```

---

## Hailuo prompt template (5-sentence rule)

```
[CAMERA STATEMENT]. [SUBJECT POSITION]. [ONE SIMPLE ACTION AT
SPECIFIC SECOND]. [WHAT MUST STAY STILL]. [LIGHTING UNCHANGED].
```

Always upload Lily reference photo for cat continuity.

---

# Video #4 — Body Language

**Hook:** *"6 seconds of my cat. AI told me she was annoyed."*
**Length:** 18s
**Single insight:** the AI reads body language with frame-level specificity — tail, ears, eyes, posture, motion — not generic "your cat seems content."

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat in ambiguous body-language pose at window | `what is she actually feeling?` |
| 0:03–0:13 | Same clip held + Co-Star typography overlay reveal (line by line) | `Tail flicking every 1-2 sec.` `Ears rotated outward by sec 4.` `Pupils slightly dilated.` `Defensive crouch — something startled her.` `Give her space.` |
| 0:13–0:16 | Cat slowly emerging / relaxed posture | `she'll be back.` |
| 0:16–0:18 | Brand card | `CatMD. 6 seconds. AI reads them. catmd.pet` |

### AI clips (Hailuo)

**Clip 1 — Ambiguous tense cat (0:00-0:13)** — held under typography
```
Static camera, side angle. The cat sits upright at a window
watching something out of frame. The tail flicks slowly once at
second 2. Ears rotate slightly at second 4. Background remains
completely still. Lighting unchanged.
```

**Clip 2 — Relaxed emergence (0:13-0:16)**
```
Static camera. The cat lies down on a warm cream surface,
shoulders relaxed. The cat blinks slowly once at second 2.
Background remains completely still. Lighting unchanged.
```

---

# Video #5 — Daily Card

**Hook:** *"she sends me a card every evening."*
**Length:** 18s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat in evening sunbeam | `7pm. every evening.` |
| 0:03–0:11 | Held cat clip + Co-Star typography reveal | `*"the bird at the window was unreasonable for thirty seconds."*` `— Lily, today` |
| 0:11–0:15 | Cat looking out window | `like Co-Star. but the cat.` |
| 0:15–0:18 | Brand card | `CatMD. A card from your cat. Every evening. catmd.pet` |

### AI clips

**Clip 1 — Evening sunbeam cat**
```
Static camera. The cat lies in a warm golden evening sunbeam, eyes
half-lidded. The cat blinks slowly once at second 2. Background
remains completely still. Lighting unchanged.
```

**Clip 2 — Cat at window**
```
Static camera, side angle. The cat sits upright at a window in
golden afternoon light. The cat's tail flicks slowly once at
second 3. Background remains completely still. Lighting unchanged.
```

---

# Video #6 — Cat Studio

**Hook:** *"every week, my cat is somebody else."*
**Length:** 15s
**Note:** This video is uniquely visual-asset-driven. Generate 4-6 Nano Banana posters of Lily as different characters; the posters ARE the content.

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:02 | Real Lily AI clip — sitting normally | `meet Lily.` |
| 0:02–0:11 | Quick-cut carousel of 4 themed posters (1.5s each + 0.75s transitions) | (poster names appear as subtitles per cut: `Renaissance.` `Pixar.` `Studio Ghibli.` `80s anime.`) |
| 0:11–0:13 | Cut back to real Lily clip | `same cat.` |
| 0:13–0:15 | Brand card | `CatMD. Every week, somebody else. catmd.pet` |

### Nano Banana poster prompts (4 themes — 1.5s each in video)

Generate each as a 9:16 vertical poster.

**Renaissance:**
```
A short-haired tabby cat (reference photo attached) in a Renaissance
oil-painting portrait style. Three-quarter angle, dignified pose.
Dark velvet background. Warm golden chiaroscuro lighting. Wearing
a small ruff collar. The painting has the soft brushwork of a 17th-
century Dutch master. Faux gold frame edge visible.
```

**Pixar:**
```
A short-haired tabby cat (reference photo attached) rendered in
modern Pixar 3D animation style. Big expressive eyes. Soft volumetric
fur, slight stylization. Standing in a sunlit kitchen. Warm Pixar
color palette.
```

**Studio Ghibli:**
```
A short-haired tabby cat (reference photo attached) in Studio Ghibli
2D animation style. Watercolor texture. Sitting on a stone wall in a
green hillside. Soft sky, gentle wind in fur. Distinct Miyazaki
aesthetic.
```

**80s anime:**
```
A short-haired tabby cat (reference photo attached) in 1980s
Japanese anime cel-shaded style. Bold linework. Synthwave color
palette — magenta, cyan, deep blue. Flat shading. A retro neon
backdrop. The cat looks heroic.
```

### Bonus AI clip
**Clip — Real Lily (0:00-0:02 + 0:11-0:13)** — same clip used both times
```
Static camera. The cat sits upright on a warm cream surface,
looking calmly at the lens. Slow blink at second 1. Background
unchanged.
```

---

# Video #7 — Weekly Reading

**Hook:** *"once a week, she reads ME."*
**Length:** 18s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat watching from a high perch (down-angle) | `once a week, she reads ME.` |
| 0:03–0:13 | Held watching clip + Co-Star typography reveal | `*"You haven't been sleeping."* *"Your scent is off three nights running."* *"The chair holds the shape of you longer now."* *"Address yourself."*` |
| 0:13–0:16 | Cat blinks slowly, unbroken eye contact | `she's been watching.` |
| 0:16–0:18 | Brand card | `CatMD. Once a week, she reads you. catmd.pet` |

### AI clips

**Clip 1 — Cat watching from high perch**
```
Static camera, slight low-angle looking up. The cat sits on a high
windowsill or top of a bookshelf, looking down at the lens with a
steady, watchful expression. Eyes slightly narrowed. The cat blinks
slowly once at second 3. Background remains completely still.
Lighting unchanged.
```

---

# Video #8 — People & Pets memory

**Hook:** *"my cat just brought up my mom."*
**Length:** 15s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat sitting near a doorway, looking out | `my cat just brought up my mom.` |
| 0:03–0:11 | Held cat clip + Co-Star typography | `*"yes, Mom was here three days ago."* *"she brought the loud bag."* *"I noticed."*` |
| 0:11–0:13 | Cat blinks | `i never told her about Mom.` |
| 0:13–0:15 | Brand card | `CatMD. She remembers everyone. catmd.pet` |

### AI clip

**Clip — Cat near doorway**
```
Static camera, low-angle. The cat sits motionless near an open
doorway, looking out into a softly blurred warm-toned hallway. The
cat's tail flicks slowly once at second 2. Background remains
completely still. Lighting unchanged.
```

---

# Video #9 — Triage (the 2 AM moment)

**Hook:** *"i was about to call the vet at midnight. then I did this instead."*
**Length:** 22s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat in dim kitchen, slightly hunched, mildly concerning posture | `it's 2 AM. she keeps hiding.` |
| 0:03–0:05 | Same clip continues | `is this an emergency?` |
| 0:05–0:13 | Hold + Co-Star typography reveal | `Score: 47 / 99` `Tier: monitor` `Likely: stress-related anorexia.` `Action: monitor 24h, vet if not eating by morning.` |
| 0:13–0:18 | Cat sleeping peacefully | `she ate at 8 AM.` `the vet PDF is on file.` |
| 0:18–0:22 | Brand card | `CatMD. The 3 AM friend. catmd.pet` |

### AI clips

**Clip 1 — Concerning cat in dim kitchen**
```
Static camera, low-angle. The cat sits in a slightly hunched
posture in a dimly-lit warm-toned kitchen at night. Single warm
overhead pendant light. The cat looks small and concerning. Camera
static, slightly handheld feel. The cat's head is low, ears
slightly back. No motion otherwise.
```

**Clip 2 — Cat sleeping peacefully**
```
Static camera. The cat is curled in a perfect ball on a cream
duvet, breathing visibly and slowly. Soft amber bedside-lamp light.
Slow camera push-in — barely perceptible. Background remains
unchanged.
```

---

# Video #10 — "She told ME her shot is overdue"

**Hook:** *"my cat just told ME her FVRCP is overdue."*
**Length:** 15s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat watching, mildly disapproving | `i texted my cat 'good morning.'` |
| 0:03–0:09 | Hold + Co-Star typography (the cat's reply) | `*"Morning. The FVRCP is overdue, by the way."* *"Just so we're clear who's noticing."*` |
| 0:09–0:12 | Cat eyes narrowed, smug | `she's been keeping notes.` |
| 0:12–0:15 | Brand card | `CatMD. Your cat keeps notes. You keep up. catmd.pet` |

### AI clips

**Clip 1 — Cat watching, mildly disapproving**
```
Static camera, slight low-angle. The cat sits motionless on a high
surface (cat tower or top of fridge), looking down at the lens. The
expression is steady, unimpressed, faintly judgmental. The cat
blinks slowly once at second 2. Background unchanged.
```

**Clip 2 — Smug cat (eyes narrowed)**
```
Static camera, side angle. Close-up of the cat's face, eyes half-
lidded in self-satisfaction. The cat slowly turns head 10 degrees
toward camera at second 1. Eyes hold lens. Background unchanged.
```

---

# Video #11 — "I told my cat her weight. she filed it."

**Hook:** *"i told my cat what she weighs. she just… logged it."*
**Length:** 15s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat sitting near a small kitchen scale, indifferent | `i told my cat what she weighs.` |
| 0:03–0:09 | Hold + Co-Star typography | `me: "Lily weighs 4.5 kg now"` `Lily: *"Adequate. Logged."*` |
| 0:09–0:12 | Cat blinks once | `no form. no banner. she just filed it.` |
| 0:12–0:15 | Brand card | `CatMD. Tell your cat anything. She remembers. catmd.pet` |

### AI clips

**Clip 1 — Cat near scale**
```
Static camera, side angle. The cat sits next to a small kitchen
weight scale on a wooden countertop, facing slightly away from the
scale, expression neutral. The cat's tail flicks slowly once at
second 3. Background unchanged. Soft kitchen window light.
```

**Clip 2 — Cat blink (close-up)** — reuse from voice library
```
Static camera, close-up. The cat slowly closes eyes over 2 seconds
starting at second 1, holds closed for 1 second, reopens. No body
movement. Lighting unchanged.
```

---

# Video #12 — "She knows when you skipped her dose"

**Hook:** *"i asked my cat if she's sick. she called me out instead."*
**Length:** 15s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat sitting in front of an empty pill organizer, slightly affronted | `i asked my cat if she's sick.` |
| 0:03–0:10 | Hold + Co-Star typography | `me: "are you sick?"` `Lily: *"No. But you skipped my 9 AM dose yesterday."* *"The matter is logged."*` |
| 0:10–0:13 | Cat blinks, unbothered | `she's been keeping a tally.` |
| 0:13–0:15 | Brand card | `CatMD. She sees the pill bottle. She sees you. catmd.pet` |

### AI clips

**Clip 1 — Cat near pill organizer**
```
Static camera, low-angle. The cat sits next to a small pill
organizer on a wooden counter, expression slightly affronted.
Single warm pendant light overhead. The cat's tail flicks once at
second 2. Background unchanged.
```

---

# Video #13 — "She knows about the green chair" (NEW — Memory pillar)

**Hook:** *"my cat just referenced furniture i never told her about."*
**Length:** 18s — **the most important new video; emotional payoff matters**

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat lying on a green velvet/sage chair in a warm living room | `my cat just brought up the green chair.` |
| 0:03–0:11 | Held cat clip on chair + Co-Star typography | `*"the green chair was warm today."* *"you sat there too long again."* *"i corrected the shape after."*` |
| 0:11–0:15 | Cut to cat blinking on the chair, slow zoom | `i never told her about the chair.` `she figured it out from the photos.` |
| 0:15–0:18 | Brand card | `CatMD. She figured it out from the photos. catmd.pet` |

### AI clips

**Clip 1 — Cat on green chair**
```
Static camera, side angle. The cat lies sprawled on a sage-green
velvet armchair in a warm living room. Soft afternoon window light.
The cat blinks slowly once at second 3. Background remains static.
Lighting unchanged.
```

**Clip 2 — Cat close-up on green chair (slow zoom)**
```
Static camera, slow push-in over 5 seconds. Close-up of the cat's
face on the green chair, eyes half-lidded in contentment. The cat
blinks slowly once at second 2. Background remains static.
```

---

# Video #14 — Postcard

**Hook:** *"today's photos, captioned by my cat."*
**Length:** 15s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | AI clip of cat in morning routine | `today, in 4 photos.` |
| 0:03–0:09 | Quick-cut carousel of 4 cat photos (real-feel, AI) — 1.5s each | (no overlay — let visuals carry it) |
| 0:09–0:13 | Held final photo + Co-Star typography | `*"sunbeam. window. yawn. sunbeam again."* *"adequate."*` `— Lily, today` |
| 0:13–0:15 | Brand card | `CatMD. Today, in your cat's voice. catmd.pet` |

### AI stills (Nano Banana — generate 4 photo-style stills, NOT animated clips)

Each is a 1080×1080 photo-style cat moment in a different mood/setting:
- Morning sunbeam
- Window watching
- Mid-yawn
- Late afternoon sunbeam (slightly different angle from #1)

Use the same Lily reference photo for character consistency. These are STILLS used as 1.5s static shots in the carousel — saves Hailuo cost since no animation needed.

---

# Video #15 — "48 hours later"

**Hook:** *"i ran a vet scan two days ago. then this notification came."*
**Length:** 18s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Cat looking off, vaguely concerning posture | `Tuesday, 2 AM.` `she kept hiding.` |
| 0:03–0:06 | Cat continues, hold | `i ran the scan.` |
| 0:06–0:11 | Hold + Co-Star typography | `Score: 52 / 99` `Tier: monitor` `48 hours later, this:` |
| 0:11–0:14 | Cat lying calmly in good light | `*"how's Lily doing?"* *"she's fine. eating. sleeping."*` |
| 0:14–0:16 | Cat eyes closed, content | `she remembered to ask.` |
| 0:16–0:18 | Brand card | `CatMD. The friend who follows up. catmd.pet` |

### AI clips

**Clip 1 — Concerning cat (Tuesday)**
```
Static camera, dim warm overhead light. The cat sits slightly
hunched in a kitchen at night, head low, ears slightly back. The
cat's tail flicks once at second 2. Background unchanged.
```

**Clip 2 — Recovered cat (Thursday)**
```
Static camera, bright morning kitchen window light. The cat is
upright on a chair, eyes alert. The cat blinks slowly once at
second 2. Background unchanged.
```

**Clip 3 — Content cat sleeping**
```
Static camera. The cat is curled on a cream cushion, eyes closed,
slow visible breathing. No motion. Soft warm light unchanged.
```

---

# Video #16 — "She knew which one was MINE"

**Hook:** *"i took a photo with three cats. the app picked out the one that was mine."*
**Length:** 12s

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:03 | Three cats in a photo arrangement (AI still, not video) | `three cats.` |
| 0:03–0:07 | Same image, gentle highlight glow on Lily (the brand cat) — Co-Star typography | `she picked the one that was mine.` |
| 0:07–0:10 | Lily alone in close-up | `she knew.` |
| 0:10–0:12 | Brand card | `CatMD. Built for cats only. catmd.pet` |

### AI assets

**Still 1 — Three cats** (Nano Banana, not Hailuo)
```
A photo-style image of three different cats arranged on a warm
cream sofa in soft window light. Three distinct breeds/colors —
include one short-haired tabby that matches the Lily reference
(reference photo attached for the tabby cat in the middle).
Editorial photography style, shallow depth of field. Cinematic.
```

**Clip — Lily alone (close-up)** — reuse from earlier videos' library
```
Static camera, close-up. The cat sits looking calmly at the lens,
warm window light. Slow blink at second 2. Background unchanged.
```

---

# Video #17 — "Year One" (drop later — Q4 2026 when cohort data exists)

**Hook:** *"my cat just sent me a year of us."*
**Length:** 28s — earns the longer length; emotional pacing

### Shot list

| Time | Visual | Text overlay |
|---|---|---|
| 0:00–0:04 | Cat in winter window, slightly older / more confident | `it's been a year.` |
| 0:04–0:14 | Held cat clip + Co-Star typography (excerpts from diary) | `*"January — the radiator was finally on."* *"April — Mom came. she brought the loud bag."* *"July — i learned the green chair was mine."* *"December — you sat too long again. i corrected the shape."*` |
| 0:14–0:20 | Carousel of 4 stills — same Lily across 4 seasons | (subtitle: `January.` `April.` `July.` `December.`) |
| 0:20–0:26 | Cat looking at camera, eyes soft | `*"adequate."* `— Lily, year one` |
| 0:26–0:28 | Brand card | `CatMD. A year together, written down. catmd.pet` |

### AI assets

**Clip 1 — Cat in winter window**
```
Static camera. The cat sits at a window with snowy light coming
through. Slightly more mature feel — fuller fur, settled posture.
Slow blink at second 2. Background unchanged. Cool-warm winter
light.
```

**Stills 1-4 — Lily across 4 seasons** (Nano Banana)
- January: snowy window light, indoor warm contrast
- April: spring window, soft pastel light
- July: high summer, golden sunbeam, lazy posture
- December: warm interior light, fully content

Same Lily reference photo across all 4 — only lighting + framing changes.

---

## Production cost summary (all 14 videos #4-#17)

| Item | Per video | Total (14 videos) |
|---|---|---|
| Hailuo clips (~3 per video × $0.27) | ~$1 | ~$14 |
| Nano Banana stills (~3-6 per video, free) | $0 | $0 |
| Brand card render (free) | $0 | $0 |
| **Total** | ~$1 | **~$14-20** |

**Time per video: ~30-45 minutes** (no app interaction, no screen recording, no app-state setup). Down from 75-90 min.

---

## What this redesign LOSES (be honest)

| Loss | Severity | Mitigation |
|---|---|---|
| The "real app" credibility signal | Medium — viewers may wonder if the app is real | Mitigation: brand card always points to catmd.pet; descriptions in caption confirm "live on iOS + Android"; first 1-2 videos can include light app footage to establish reality, then switch to typography format. |
| Specific UI moments (the diary entry sliding in, the daily card pushing) | Small | The Co-Star typography format is actually stronger than UI screenshots for shareability. UI ages; typography doesn't. |
| User can't recognize the actual app from the video | Small if the brand card is consistent | Ensure brand card aesthetic in videos matches actual app brand card aesthetic exactly. |

**Biggest UNEXPECTED win:** the typography reveals are MORE on-brand than UI screenshots. The Co-Star aesthetic is the brand identity. Videos that use it look like a designed editorial product. Videos that screen-record UI look like ad-tech.

---

## Production order recommendation

Given that the Co-Star typography template is reusable across all 14 videos, **build it ONCE in CapCut**, then mass-produce in batches:

1. **Day 1 (~3-4h):** Generate all 30+ Hailuo clips needed across all 14 videos. Queue them. Pick best takes. Batch download.
2. **Day 2 (~2-3h):** Generate all Nano Banana stills (brand cards + Cat Studio posters + Postcard photos + Year One season stills). Free quota covers it.
3. **Day 3 (~3-4h):** Build CapCut typography template. Then assemble videos #4, #5, #7, #8 using the template — these are the simplest 4-act structures.
4. **Day 4 (~3-4h):** Assemble #10, #12, #13 (the proactive memory videos — heavier typography).
5. **Day 5 (~2-3h):** Assemble #6 (Cat Studio carousel), #14 (Postcard carousel).
6. **Day 6 (~3-4h):** Assemble #9 (Triage), #11, #15, #16.
7. **Hold #17 for Q4** — needs cohort data + 4-season Lily stills.

**Total:** ~15-20 hours across 6 days for 13 videos (excluding #17). Down from 35-40h with walkthroughs.

---

## What stays from the original storyboards

- All hooks, all single insights, all brand voice register
- Caption copy per platform (no change)
- TikTok Search SEO term inclusion (no change)
- Drop schedule per `MARKETING-OPERATING-PLAN.md` (Week 1+)
- Audio direction per video (sustained pads, no trending audio for the eerie ones)

---

## Open question for founder

Should Video #1 (Chat — already produced with screen recording) be re-produced in the no-walkthrough format too, for series consistency? Or keep #1 as the "this is real, screen recording proves it" anchor and switch to typography from #4 onward?

**My take:** keep #1 as-is. It serves as the credibility anchor — the one video that proves the app is real. Subsequent videos can be more designed/typographic since the app's reality is already established. This is actually a SMARTER series architecture than uniform-format videos.

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-09 | Initial. 14 videos redesigned for zero-walkthrough production. Co-Star typography template + AI clips + brand cards only. Production time per video drops from 75-90 min to 30-45 min. Total bank cost drops from ~$50 to ~$15-20. |
