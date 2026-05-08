# SKILL: image-generation

> **Owned by:** Any agent
> **Trigger:** On-demand + autonomous (cat-influencer outreach, social cards, ad creative)
> **Companion:** `knowledge/PRODUCT.md` (brand palette, voice), Nano Banana via Google AI Studio, Imagen / Gemini Flash Image

---

## What this skill does

Generates branded images via Nano Banana (Gemini 2.5 Flash Image, free quota). Use cases:
1. Custom Feline Five archetype cards for cat-influencer outreach (Nala Cat, Smoothie, Cole and Marmalade, etc.)
2. Brand cards for video closers
3. Social media graphics (X, IG, LinkedIn)
4. Ad creative (Apple Search Ads, TikTok Spark Ads — different aspect ratios)
5. Press kit assets
6. Email header graphics
7. Product Hunt launch assets
8. Quora answer thumbnails

---

## Brand consistency rules

Every generated image MUST use:

| Element | Spec |
|---|---|
| **Background** | Cream `#FAF7F2` (or warm off-white) — NEVER pure white |
| **Primary** | Sage `#5B8A7A` (or sage dark `#3F6456` for text on cream) |
| **Accent** | Terracotta `#C97B63` (for CTAs and emotional accents) |
| **Text** | Charcoal `#1F2024` (NEVER pure black) |
| **Font** | Source Serif 4 for display + headlines; Figtree for UI text |
| **Cat (when shown)** | Lily reference photo uploaded for consistency — same cat across all marketing |
| **Aesthetic** | Editorial, cinematic, generous whitespace, shallow depth of field |
| **NEVER** | Loud colors, multiple emoji, generic AI-art "cute" style, neon, gradients |

## Common asset templates

### Custom Feline Five archetype card (for cat-influencer DMs)

```
A 1080×1920 vertical card in CatMD brand style. Cream background
(#FAF7F2) with subtle warm-paper texture. At the top, a circular
photo (provided) of [CAT NAME] styled cinematically with soft
window light. Below the photo, in elegant Source Serif 4 italic:
"[CAT NAME]". Below in larger sage green serif: "[ARCHETYPE NAME]".
Below in italic, smaller: "[ARCHETYPE TAGLINE]". A subtle terracotta
accent line. Footer in tiny sage: "CatMD · Feline Five · catmd.pet".
Generous whitespace, luxurious editorial feel.
```

### Brand card (video closer)

```
A minimalist 9:16 vertical card. Cream background (#FAF7F2). At
the top center, a small dark sage circular icon (cat silhouette
in a sage circle). Below the icon, in elegant serif typography
(Source Serif 4 style), the words "CatMD" in sage dark green
(#3F6456). Below that: "[VIDEO-SPECIFIC TAGLINE]". Below that:
"catmd.pet". Centered, generous whitespace, luxurious editorial
feel.
```

### Social media post graphic (1:1 square or 16:9 horizontal)

```
A 1080×1080 (or 1600×900) editorial card. Cream background. Quote
in elegant Source Serif 4 italic, 70% width: "[QUOTE]". Below quote
in smaller sage: "— from CatMD". Subtle terracotta accent line at
bottom. Footer: "catmd.pet". No emoji, no decorative elements,
just typography.
```

### Apple Search Ads creative (1242×2208 portrait)

```
A 1242×2208 vertical card. Cream background top half showing a
cinematic photo of Lily (reference attached) in soft window light.
Bottom half cream with editorial typography: large sage Source
Serif headline "[VALUE PROP]" (e.g., "Your cat. Decoded."). Below
in italic: "[FEATURE LINE]" (e.g., "AI that replies in their
voice."). Footer terracotta CTA: "Download Free." App Store badge
implied at bottom.
```

### TikTok Spark Ad creative (square or vertical thumbnail)

```
A 1080×1920 vertical thumbnail. Top: a real screen recording frame
of a cat reply card (provided). Bottom 30%: cream banner with
Source Serif headline "[HOOK]" (e.g., "Wait — your cat is what?").
Footer: catmd.pet in tiny terracotta. Editorial, not loud.
```

### Press kit hero image (3:2 horizontal, 1500×1000)

```
A 1500×1000 horizontal hero. Cream background with three vertical
phone-screen mockups arranged in a stagger: chat reply, diary
entry, personality archetype reveal. Each mockup shows a real
CatMD UI screenshot. Soft drop shadows. Footer: "CatMD · AI for
cat owners · catmd.pet". Editorial, magazine-cover quality.
```

## Step-by-step

| Step | Action |
|---|---|
| 1 | Identify asset need (DM target, video closer, ad creative, press asset, etc.) |
| 2 | Pick the matching template above (or compose new one for novel use cases) |
| 3 | Upload Lily reference photo to Nano Banana (when cat is shown) |
| 4 | Paste the prompt with variables filled in |
| 5 | Generate 3-4 variations |
| 6 | Quality-check: brand palette compliance, typography, no generic-AI artifacts |
| 7 | Save best to `marketing/assets/generated/[purpose]/[date].png` |
| 8 | If for DM/cross-post, attach to the relevant draft and notify owner agent |

## Quality gate (no exceptions)

- ✅ Cream background (no pure white)
- ✅ Sage as primary color (not blue/red/purple)
- ✅ Source Serif 4 typography (not generic sans)
- ✅ Brand palette colors only
- ✅ Generous whitespace (not crowded)
- ✅ Editorial feel (not "promotional design")
- ✅ Lily character consistent (when shown)
- ❌ Reject: loud colors, emoji-heavy, gradients, neon, generic stock-photo aesthetic, "cute cat" cliché

## Cost tracking

- Nano Banana / Gemini 2.5 Flash Image: free quota (substantial — ~50+ generations/day)
- If quota exceeded: queue for next day, don't fall back to paid Imagen unless explicitly budgeted

## Autonomous use cases

The bot autonomously generates:

| Trigger | Asset |
|---|---|
| New cat-influencer prospect identified | Custom Feline Five archetype card |
| New X build-in-public post drafted | Optional accompanying graphic if a number/quote stands out |
| New Substack post drafted | Hero image for the post |
| New press pitch drafted | Press kit hero refresh if outdated |
| Threshold-alert fires | Celebration graphic (e.g., "100 paid users") for X cross-post |

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Brand-consistent image generation across all marketing surfaces. |
