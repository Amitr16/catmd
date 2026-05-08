# MCP Integration Spec — What Founder Needs to Provide

> **Drafted:** 2026-05-07 (D3)
> **For:** OpenClaw marketing-bot deployment
> **Purpose:** Single doc the founder can fill in over 2-3 hours to wire up the bot's external tool access. Each row tells you: what the bot needs, why, where to get it, what it costs, and what risks come with it.

---

## TL;DR — what's free vs paid

| Tool | Status | Cost |
|---|---|---|
| PostHog | Founder has — easy | Free (under 1M events) |
| RevenueCat | Founder has — easy | Free (under $10K MTR) |
| Play Console | Founder has — moderate setup | Free |
| App Store Connect | Pending Apple Dev approval | Free once unblocked |
| **Reddit** | Free OAuth — works | Free |
| **X (Twitter)** | ⚠️ Posting requires paid tier | $100/mo (Basic) for posting |
| **Instagram (post)** | Requires Meta Business approval | Long process; defer to browser automation |
| **TikTok (post)** | Limited / unofficial | Defer to browser automation |
| **Browser automation** (TAAFT, AlternativeTo, etc.) | Free with Playwright | Setup time |

**Realistic recommendation for $500/mo budget:** wire up PostHog + RevenueCat + Play Console + Reddit for read+post. Use browser automation for IG, TikTok, X (read), and directory submissions. **Skip X paid tier ($100/mo) until MRR > $1K.**

---

## 1. PostHog (analytics — read-only)

### What the bot needs
- Daily metric pulls: DAU, MAU, retention cohorts (D1/D7/D30), event counts (chat_used, diary_read, share_card_exported, triage_completed)
- Cohort analysis weekly

### What you need to provide

| Field | Where to find | Format |
|---|---|---|
| `POSTHOG_API_KEY` | PostHog → Settings → API → Personal API key (create one for "openclaw-bot") | `phc_...` string |
| `POSTHOG_PROJECT_ID` | PostHog → Project Settings → Project ID | Integer |
| `POSTHOG_HOST` | If self-hosted, your URL. If cloud, `https://app.posthog.com` or `https://eu.posthog.com` | URL |

### Permissions to grant
- Read events ✅
- Read insights ✅
- Read cohorts ✅
- Write: NONE (bot is read-only on PostHog)

### MCP server
- **Name:** `posthog-mcp`
- **Source:** PostHog publishes official MCP server — use that
- **Setup time:** ~10 min once API keys are in hand

---

## 2. RevenueCat (monetization — read-only)

### What the bot needs
- Daily MRR, paying users count, trial starts, trial conversions, churn
- Threshold alerts on first paying user, 10/100/250 paid users, $1K MRR

### What you need to provide

| Field | Where to find | Format |
|---|---|---|
| `REVENUECAT_API_KEY` | RevenueCat → Project Settings → API keys → Public REST API key (or Secret if you trust the local network) | `rc_...` string |
| `REVENUECAT_PROJECT_ID` | RevenueCat → Project Settings | UUID |

### Permissions to grant
- Read subscriptions ✅
- Read overview metrics ✅
- Write: NONE

### MCP server
- **Name:** `revenuecat-mcp` (community-maintained as of 2026)
- **Setup time:** ~10 min

---

## 3. Google Play Console (Android store — read)

### What the bot needs
- Daily downloads, install/conversion rate, ratings, country breakdown
- Recent reviews + 1-star alerting

### What you need to provide

| Field | Where to find | Format |
|---|---|---|
| Service account JSON | Google Cloud Console → IAM → Service accounts → create + download JSON key | Full JSON file |
| Play Console permissions | Play Console → Settings → API access → grant the service account read permissions | Configured in console |

### Permissions to grant (in Play Console)
- View app information ✅
- View financial data ✅
- View ratings + reviews ✅
- Write / publish: NONE

### Setup steps for you
1. Go to Google Cloud Console (console.cloud.google.com) → create new project "catmd-marketing-bot" if not exists
2. Enable "Google Play Android Developer API"
3. IAM → Service Accounts → Create service account "openclaw-bot"
4. Service account → Keys → Add Key → JSON → download
5. Save the JSON to `~/.openclaw/secrets/play-console.json` (chmod 600)
6. Play Console → Setup → API access → invite the service account email → grant View permissions

### MCP server
- **Name:** `google-play-mcp`
- **Setup time:** ~30 min (Google Cloud setup is the slow part)

---

## 4. App Store Connect (iOS store — read)

### Status
- Pending Apple Dev account approval. **Skip this section until Apple unblocks you.**

### When ready

| Field | Where to find | Format |
|---|---|---|
| App Store Connect API Key | App Store Connect → Users and Access → Keys → API Keys → Generate | `.p8` file + Key ID + Issuer ID |
| Issuer ID | Same page | UUID |
| Key ID | Same page | String |

### Permissions
- Access: Reports access (for analytics) ✅
- Access: App Manager (for listing) — optional, not for bot
- Write to listings: NONE for bot (you do those manually in App Store Connect)

### MCP server
- **Name:** `app-store-connect-mcp`
- **Setup time:** ~20 min once keys are generated

---

## 5. Reddit (read + post-with-approval)

### What the bot needs
- Read fresh posts in r/CatAdvice + r/CatTraining + r/CatBehavior + r/SideProject + r/IndieHackers + r/IndieDev + r/AItools + r/iosapps + r/androidapps
- Post comments + posts (with founder approval — bot drafts, you publish)

### What you need to provide

| Field | Where to find | Format |
|---|---|---|
| Reddit OAuth app | reddit.com/prefs/apps → create app (script type) | Client ID + Client Secret |
| Username | The aged cat-niche account (per IDENTITY.md) | username string |
| Password (or 2FA token) | Account password | password (use app-specific password if 2FA enabled) |

### Setup steps for you
1. Go to reddit.com/prefs/apps (logged in to your aged cat-niche account)
2. Click "are you a developer? create an app..."
3. Name: "openclaw-bot-catmd"
4. App type: **script**
5. Redirect URI: `http://localhost:8080` (placeholder — script-type doesn't actually use this)
6. Submit → save the Client ID (under app name) and Client Secret

### Permissions to grant
- Read all subs ✅
- Submit posts and comments ✅ (bot drafts only — needs approval workflow before submission goes live)

### MCP server
- **Name:** `reddit-mcp` (multiple community implementations — pick one with PRAW underneath)
- **Setup time:** ~15 min

### Approval workflow
The bot does NOT auto-submit. Workflow:
1. Bot drafts comment + saves to drafts directory
2. Bot pushes Slack notification with the draft + the target URL
3. Founder reviews, approves
4. Approved drafts go to a queue file (`~/.openclaw/workspace/approved-reddit-queue.md`)
5. Bot picks up the queue, posts via Reddit API, updates `memory/reddit-log.md` with success/failure

---

## 6. X / Twitter (read OK, posting is paid)

### Reality check (2026)
- X Free tier: read 1,500 tweets/month + can authenticate but can't post
- X Basic tier: $100/mo — read 50K tweets/month + post 100/day
- X Pro: $5K/mo — full access

### Recommendation
**For pre-Week-2 / pre-revenue: skip X API. Use browser automation (see §10) for X posting. Read X analytics manually.**

When MRR > $1K (Week 6+ if base case): consider X Basic ($100/mo) for proper API automation.

### What you need to provide (when ready)

| Field | Where to find | Format |
|---|---|---|
| X Developer Account | developer.twitter.com → sign up + verify | — |
| API Key + Secret | Developer Portal → Project → Keys | strings |
| Bearer Token | Same page | JWT string |
| Access Token + Secret | Project → user authentication settings | strings |

### Permissions to grant
- Read tweets ✅
- Post tweets ✅ (Basic tier required for posting)
- Read DMs: optional

### MCP server
- **Name:** `x-mcp` (community)
- **Setup time:** ~30 min

---

## 7. Instagram (read own analytics, posting via browser automation)

### Reality check
- IG Graph API requires Meta Developer Account + Business account on IG + 2-week+ approval process
- Posting via API is gated and unreliable
- For an indie founder, browser automation (§10) is faster and more reliable

### Read-only analytics (when set up)

| Field | Where to find | Format |
|---|---|---|
| Meta Developer App | developers.facebook.com → My Apps → create | App ID + App Secret |
| IG Business Account ID | Connected to your IG account in Meta Business Suite | Numeric ID |
| Long-lived access token | Generated via OAuth flow | string |

### Recommendation
**Skip the API setup. Use browser automation (§10) for posting + read IG insights manually.**

---

## 8. TikTok (read-only via TikTok Business API; posting via browser automation)

### Reality check
- TikTok Business API: limited capability, requires application approval
- TikTok Content Posting API: very restricted, primarily for enterprise
- For indie: browser automation is the realistic path

### What you need to provide (for analytics read)

| Field | Where to find | Format |
|---|---|---|
| TikTok Business Account | business.tiktok.com → register | — |
| TikTok Business Center → API access | Apply for developer access | Approval process |
| API Key | Once approved | string |

### Recommendation
**Skip TikTok API for now. Use browser automation + manual analytics review.**

---

## 9. fal.ai (Hailuo + Nano Banana inference — for autonomous video/image generation)

### What the bot needs
- Generate Hailuo image-to-video (~$0.27/5s clip)
- Generate Nano Banana stills (free quota at Google AI Studio)

### What you need to provide

| Field | Where to find | Format |
|---|---|---|
| `FAL_KEY` | fal.ai → Dashboard → API Keys | `fal-ai-...` string |
| Spending cap | fal.ai dashboard → Billing | Set $5-10/week cap for autonomous bot use |

### Permissions
- Read models ✅
- Run models ✅
- Set hard spending cap to $5/week initially (can raise post-launch)

### MCP server
- **Name:** Custom — fal.ai exposes OpenAI-compatible API, the bot uses HTTP via TOOLS.md whitelist (no MCP needed initially)
- **Setup time:** ~5 min

---

## 10. Browser automation (for directory submissions + IG/TikTok posting)

### What the bot needs
- Navigate to TAAFT, AlternativeTo, BetaList, SaaSHub, etc. — fill submission forms autonomously
- Post to IG (when API is too slow) and TikTok (when API doesn't work)
- Auto-fill repetitive forms

### What you need to provide

| Field | What to do | Cost |
|---|---|---|
| Playwright | `pip install playwright && playwright install chromium` | Free |
| MCP server: `playwright-mcp` | Community-maintained, exposes browser to the bot | Free |
| Login state | First-time, you log in to each platform manually; Playwright saves session | Time: ~10 min per platform |
| Approval workflow | Bot drafts the form fill → screenshots → Slack notification → you approve → bot submits | Built into TOOLS.md |

### Critical safety rule
- **Bot can NAVIGATE and FILL forms autonomously, but cannot CLICK SUBMIT without approval.** All form-submit actions require Amit's approval via Slack ("approve submission to TAAFT? yes/no").

### Setup time
~30 min for Playwright + per-platform login state setup.

---

## 11. Connectively / Qwoted / SourceBottle (journalist queries — read)

### What the bot needs
- Read daily digest emails from each service
- Filter for cat-AI / pet-tech / indie-AI-app keywords

### What you need to provide

| Field | What to do |
|---|---|
| Email forwarding rule | Forward digest emails from each service to a dedicated mailbox (e.g., bot+queries@catmd.pet or a Gmail filter that labels them) |
| Bot reads via IMAP | Bot accesses the labeled folder via IMAP credentials |

### Alternative
- Each service has a web dashboard. Bot can browse-automate the dashboards via Playwright.

### Setup time
~20 min for IMAP setup + filter rules.

---

## 12. Slack (output channel)

### What the bot needs
- Send DMs to Amit with daily digests, threshold alerts, drafts

### What you need to provide

| Field | Where to find | Format |
|---|---|---|
| Slack workspace | Create at slack.com if not already | — |
| Slack App + Bot token | api.slack.com/apps → create app → Bot token | `xoxb-...` |
| User ID for Amit | Slack profile → "Copy member ID" | `U...` string |

### Permissions
- Send DMs to user ✅
- Post to channels: only the dedicated #catmd-marketing channel (if you want a public log)
- Read messages: only when Amit DMs the bot directly

### Setup time
~15 min.

---

## Priority order for setup (by ROI)

| Priority | Tool | Why first |
|---|---|---|
| 1 | **PostHog** | Without metrics, MetricsHawk + Sunday Reviewer + threshold-alerts can't function |
| 2 | **RevenueCat** | Same — paying user / MRR data is the highest-stakes signal |
| 3 | **Slack** | Without it, the bot has nowhere to push |
| 4 | **Reddit** | Highest volume daily task (ReddyTheBot). Without Reddit access, half the bot's value is lost |
| 5 | **fal.ai** | Unlocks autonomous video/image generation |
| 6 | **Play Console** | Provides Android store data + reviews |
| 7 | **Browser automation (Playwright)** | Unlocks directory submissions + IG/TikTok posting |
| 8 | **Connectively / Qwoted / SourceBottle** | Press queries — needed by Week 1 post-launch |
| 9 | **App Store Connect** | When Apple Dev unblocks |
| 10 | **X API** | Skip until MRR > $1K |
| 11 | **TikTok / IG API** | Skip — use browser automation |

---

## Setup time budget

| Tier | Time | Tools |
|---|---|---|
| Tier 1 (must-have for v1) | ~2 hours | PostHog + RevenueCat + Slack + Reddit + fal.ai |
| Tier 2 (within first week post-deploy) | ~2 hours | Play Console + Playwright + journalist email setup |
| Tier 3 (post-launch additions) | varies | App Store Connect (when unblocked), X API (when budget allows), IG/TikTok (when justified) |

---

## What I (the marketing agent) need from you to wire up Tier 1 today

Paste these values into a secure local file (e.g., `~/.openclaw/secrets/keys.env`, chmod 600):

```bash
# PostHog
POSTHOG_API_KEY=phc_...
POSTHOG_PROJECT_ID=12345
POSTHOG_HOST=https://app.posthog.com

# RevenueCat
REVENUECAT_API_KEY=rc_...
REVENUECAT_PROJECT_ID=...

# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_USER_ID=U...

# Reddit
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USERNAME=...
REDDIT_PASSWORD=... # or 2FA app password

# fal.ai
FAL_KEY=fal-ai-...
FAL_WEEKLY_CAP=5  # $5/week autonomous budget
```

Once that file exists, the deploy script (see `DEPLOY.sh`) reads it and configures the bot's MCP servers automatically.

---

## Security caveats

- **Never put this file in git.** Add `keys.env` to `.gitignore` immediately.
- **chmod 600** the file so only you can read it.
- **Don't expose any of these to the public internet** — bot runs on localhost only.
- **Rotate keys quarterly** — schedule a calendar reminder for Aug 7, 2026.

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Tier 1-3 priority. Honest reality-check on X / IG / TikTok API limitations vs browser automation. |
