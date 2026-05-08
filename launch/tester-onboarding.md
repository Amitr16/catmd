# Tester onboarding + nudge sequence

Four-message flow per tester. Copy-paste, personalize `[brackets]`, send.

---

## Message 1 — Qualify (when someone expresses interest)

```
Hey [name] — awesome, thank you. Two quick Qs before I add you:

1. Android phone? (iOS isn't live yet — launching ~8 weeks behind Android)
2. What's the Gmail you want me to add to the tester list?

Taking on 20 testers; confirming each one personally so you don't get lost in a blast.
```

**Why this wording:** "Confirming each one personally" signals craft + care, which elevates the relationship. Testers who feel bespoke treatment engage 3-4× more than testers who feel like a list.

---

## Message 2 — Send the link (after they confirm)

```
Perfect. Adding [gmail@address] to the tester list now. Here's what happens next:

1. Click this opt-in link: [YOUR_PLAY_TEST_URL]
2. Accept on the page that opens.
3. CatMD appears in your Play Store in ~10 min under "CatMD - AI Vet Triage for Cats". Install it.
4. Open the app, go through onboarding (~30 sec), try a scan — use your cat or any test symptom.

⚠️ We're in review with Google right now — the app won't fully install until
approval lands (1–3 days). You can opt in today; the install unlocks
automatically when Google greenlights us. I'll ping you when that happens.

What actually helps me most:
  → Open the app 2-3 times over the next 2 weeks. Google literally
    measures "active testers" for the graduation to public launch.
  → DM me anything weird — a crash, confusing copy, a scan that felt off.
  → Don't worry about being polite. Brutal feedback > polite feedback.

Appreciate you being one of the first 20. This bit, before public
launch, is the part that matters.
```

**Why include the review-pending caveat:** Testers who click the link and see "test not available yet" without warning will ghost. Set expectations upfront and they stay engaged.

---

## Message 3 — Day 5 nudge (for testers who installed but haven't opened)

```
Hey [name] — quick check-in.

I can see you installed CatMD (thank you!) but haven't opened it yet. That's fine, but early bugs are way more useful to catch now than after launch.

Even a single scan this week would be huge. 15 seconds, literally. If something blocks you — no notification, stuck on a screen, whatever — DM me the screenshot and I'll fix it today.
```

**How to identify inactive testers:** Play Console → Test and release → Testing → Closed testing → Beta track → Tester insights. Look at "installs" count vs "active" count. The gap is your nudge list.

---

## Message 4 — Day 10 nudge (for low-engagement testers)

```
Quick favor, [name] — could you open CatMD once this week if you get a sec?

Context: to graduate from beta to public Play Store, I need 12 testers "actively using" the app for 14 consecutive days. Google measures this automatically. We're at [X]/12 right now — every additional open compounds.

No feedback needed this time. Just open it. 🙏
```

**Keep this short.** A full paragraph will get archived. The ask is literally one action; keep the message length matching.

---

## Message 5 — Day 14 thank-you (for active testers)

```
Thanks for testing, [name]. The public Play Store launch is [next week / this Thursday / etc.]. You'll keep getting updates automatically — you don't need to do anything.

If you want to spread the word, the public link will be [catmd.pet] (landing page) and a direct Play Store URL once it's live.

I owe you a coffee. If you're ever in Singapore, hit me up.
```

---

## Message 6 (optional) — Churn email for people who never opted in

Send this 3-4 days after you sent Message 2 with no response:

```
Hey [name] — saw you haven't opted in yet. Totally fine, no pressure.

If you changed your mind or the Android thing is a blocker, just LMK. I'd rather know than wonder.

If you're still in, the opt-in link is [YOUR_PLAY_TEST_URL] — takes 30 seconds.
```

Single bump. Don't send a third. People who don't respond to message 2 + 6 aren't coming.

---

## Tracker sheet schema (Google Sheets / Airtable)

| Column | Type | Purpose |
|---|---|---|
| Name | text | tester's first name |
| Channel | dropdown | Personal / Reddit / FB / Telegram / TikTok / Twitter / Nextdoor / Discord / Vet / Referral |
| Contact method | text | phone / handle / email |
| Gmail | text | for Play Console list |
| Cat owner + Android? | checkbox × 2 | hard filter |
| Status | dropdown | Invited / Opted-in / Installed / Active / Churned |
| Msg 1 sent | date | qualify message |
| Msg 2 sent | date | opt-in link |
| Msg 3 sent | date | day-5 nudge |
| Msg 4 sent | date | day-10 nudge |
| Msg 5 sent | date | thank-you |
| Feedback collected | text | notable testers — what they said |
| Notes | text | anything unique |

**Formula for daily active tracker:**
Count of rows where Status = "Active" → should hit 12 by Day 14 of the 14-day clock.

---

## Anti-patterns to avoid

- ❌ **Mass-BCC email blast.** Reply rate drops from 60% to 8%.
- ❌ **"Follow up" that doesn't acknowledge silence.** Condescending.
- ❌ **Sending the opt-in link before confirming Gmail + Android.** Creates ghost testers.
- ❌ **Long messages on day-10 nudge.** Testers are busy; match message length to ask.
- ❌ **Treating testers as a funnel.** They're beta *collaborators*. Talk to them that way.
