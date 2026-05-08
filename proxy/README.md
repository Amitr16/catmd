# CatMD AI Proxy

A tiny Cloudflare Worker that sits between the CatMD app and OpenAI.

Why: the real OpenAI API key lives in a Cloudflare secret instead of the
APK bundle. Anyone who decompiles the app finds no usable credentials.
The Worker also lets us rotate keys, throttle abuse, and (later) add
caching without shipping a new app version.

---

## One-time setup (≈ 10 minutes)

You need: a Cloudflare account (free tier is fine) + Node.js 20+.

```powershell
# 1. From the project root
cd D:\apps\catmd\proxy
npm install

# 2. Log in to Cloudflare
npx wrangler login

# 3. Set the real OpenAI key as a secret — you will be prompted to paste it.
#    Create a new key at https://platform.openai.com/api-keys with a sensible
#    monthly spending limit first.
npx wrangler secret put OPENAI_API_KEY

# 4. Optional: set a shared secret so random people on the internet can't
#    hit your proxy for free. Paste any long random string. You will set
#    the same value in the app's .env as EXPO_PUBLIC_AI_APP_SECRET.
npx wrangler secret put APP_SECRET

# 5. Deploy
npx wrangler deploy
```

Wrangler prints a URL like:

```
https://catmd-ai-proxy.<your-subdomain>.workers.dev
```

Copy that URL — it's the AI base URL the app will point at.

---

## Point the app at the proxy

Edit `D:\apps\catmd\.env`:

```ini
EXPO_PUBLIC_AI_BASE_URL=https://catmd-ai-proxy.<your-subdomain>.workers.dev/v1

# Blank these — the proxy holds the real key.
EXPO_PUBLIC_OPENAI_API_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY=

# If you set an APP_SECRET in step 4, mirror it here. Leave blank otherwise.
EXPO_PUBLIC_AI_APP_SECRET=<same-value-you-gave-wrangler>
```

Restart Metro with `npx expo start --clear` so the new env vars load.
From this point on, the app makes requests to the Worker, which forwards
them to OpenAI using the secret key.

---

## Verifying it works

```powershell
# Call the proxy with a trivial request. Should print a chat response.
$headers = @{
  "Content-Type" = "application/json"
  "X-CatMD-App-Secret" = "<the APP_SECRET you set>"
}
$body = @{
  model = "gpt-4o-mini"
  messages = @(@{role="user"; content="ping"})
} | ConvertTo-Json
Invoke-RestMethod -Method Post `
  -Uri "https://catmd-ai-proxy.<your-subdomain>.workers.dev/v1/chat/completions" `
  -Headers $headers -Body $body
```

If the response comes back with chat content, the proxy is live.

---

## Abuse protection checklist

1. **Spending limit on the OpenAI key** — set this first at
   platform.openai.com. Prevents a runaway bill even if the secret leaks.
2. **APP_SECRET** — set it. Keeps out random drive-by scrapers.
3. **Cloudflare WAF rate-limiting rule** — in the Cloudflare dashboard,
   under Security → WAF → Rate limiting rules, add a rule such as
   "10 requests per 10 seconds per IP" on the Worker route. Free tier
   supports this.
4. **Rotate APP_SECRET** if the app is ever dumped — just rerun step 4
   and ship a new app version with the new value.

---

## Costs

- Cloudflare Workers free tier: **100,000 requests / day**. Plenty for
  10k MAU × ~10 scans/month.
- If you exceed that, Workers Paid is **$5 / month** for 10M requests.
- OpenAI costs are unchanged from direct calling — the proxy is
  pass-through.

---

## Upgrading later

Easy wins once the proxy exists:

- **Per-user rate limiting** — hash the anonymous Supabase user id and
  use Cloudflare KV / Durable Objects to count requests.
- **Response caching** — for the embeddings endpoint, cache identical
  text inputs for 24 hours. Can reduce OpenAI bill by 10-30%.
- **Token counting + daily-spend shutoff** — estimate tokens, write to
  KV, cut off before the OpenAI bill runs away.
- **Swap providers** — add routing so emergency-tier scans call
  Anthropic's Claude while routine scans stay on gpt-4o-mini. No app
  redeploy needed.
