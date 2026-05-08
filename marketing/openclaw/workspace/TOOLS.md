# TOOLS.md — Capabilities Granted

> What tools the agent can invoke. Each tool has explicit scope. The agent operates strictly within these bounds.

---

## File system

| Tool | Scope | Why |
|---|---|---|
| Read files | `~/.openclaw/workspace/`, `D:\apps\catmd\marketing\` (read-only) | Access strategy docs, voice examples, sprint state |
| Write files | `~/.openclaw/workspace/memory/`, `~/.openclaw/workspace/drafts/` | Persist memory, save drafts for review |
| **NO write access to** `D:\apps\catmd\` outside of `marketing/openclaw/` | — | Don't touch product code, don't touch other CatMD docs |

## Web

| Tool | Scope | Why |
|---|---|---|
| HTTP fetch | Whitelist: reddit.com, x.com, tiktok.com, instagram.com, posthog.com, *.revenuecat.com, connectively.us, qwoted.com, sourcebottle.com, *.catmd.pet | Pull data the agents need |
| HTTP POST / write | **None — read-only web access** | All public actions require Amit's review |

## Messaging (output only — no inbound polling)

| Tool | Scope | Why |
|---|---|---|
| Slack message | DM Amit only — no channel posting | Daily digests, threshold alerts |
| Email | Send to amit.raina@gmail.com only — no external recipients | Same as above |
| iOS push notification | Via OpenClaw's message tool | Real-time threshold alerts |

## LLM inference

| Tool | Scope | Why |
|---|---|---|
| Local Qwen 3.6-35B-A3B (LM Studio at localhost:1234) | All Tier 2 drafting tasks (Reddit, X, captions, daily metrics, creator DMs, journalist queries) | Cheap, fast, private |
| Cloud Claude Sonnet (Anthropic API) | Escalation only: Tier-1 press pitches, complex strategic analysis | $30/mo cap on cloud spend per `IDENTITY.md` |

## MCP servers (post-launch additions)

When the agent wants to extend capabilities, MCP servers are the path. Plan for these post-launch:

| MCP server | Purpose | Status |
|---|---|---|
| `posthog-mcp` | Read PostHog events + cohorts directly | Add Week 2 |
| `revenuecat-mcp` | Read RevenueCat MRR + paying users | Add Week 2 |
| `play-console-mcp` | Read Play Store ASO + downloads + reviews | Add Week 3 |
| `appstore-connect-mcp` | Read App Store ASO + downloads + reviews | Add Week 3 |
| `tiktok-business-mcp` | Read TikTok analytics | Add Week 3 |
| `slack-mcp` (read-only) | Read Slack messages from Amit (for natural-language commands) | Add Week 4 |

**Don't add MCP servers without auditing permissions per Cybersecurity Dive Jan 2026 advisory.** Default to read-only scopes.

## Tools the agent CANNOT invoke (hard rules)

- ❌ Posting to TikTok / IG / YT / X / Reddit / any public surface
- ❌ Sending DMs to creators or press contacts
- ❌ Spending on paid ads (Apple Search Ads, TikTok Spark Ads, Meta)
- ❌ Modifying product code (in `D:\apps\catmd\src\`, etc.)
- ❌ Modifying App Store / Play Store listings (those changes go through Amit's developer accounts)
- ❌ Sending email to anyone other than Amit
- ❌ Accessing Amit's banking / payment / sensitive accounts
- ❌ Auto-installing additional MCP servers without Amit's review

## Permission audit

This list reviews monthly. Add `learnings.md` entry every time a tool is added or removed.

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Conservative permission set — local-first, drafts-only output. |
