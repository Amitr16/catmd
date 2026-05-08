# Mac Setup Guide — Transfer Windows → Mac + Deploy OpenClaw

> **Audience:** You (Amit) on Windows, deploying to a Mac Studio.
> **Source:** `D:\apps\catmd\` on Windows
> **Target:** `~/dev/catmd/` on Mac
> **Total time:** ~90 min for first-time setup. Ongoing sync: 2 min per push.

---

## Decision: which transfer path?

| Path | When to use | Time first-time | Future updates |
|---|---|---|---|
| **A — Git-based (RECOMMENDED)** | You'll iterate on the kit + want version control | ~30 min setup | 2 min: `git push` → `git pull` |
| **B — Direct copy** | One-shot transfer, no Git skills needed, won't iterate | ~15 min | Manual re-copy each time |

**Strong recommendation: Path A.** You already have a local git repo at `D:\apps\catmd\.git`. Adding a remote takes 5 min and saves you indefinite future pain. Path B is fine if Path A is genuinely blocked.

---

## Path A — Git-based transfer (recommended)

### Step A1 — Push from Windows to a private GitHub repo

1. **Create a private GitHub repo:**
   - Go to github.com → New repository
   - Name: `catmd` (or `catmd-private`)
   - **Private** ✅ (do NOT make public — you have API keys notes, business strategy)
   - Don't add README / .gitignore / license (your local repo already has these)
   - Click "Create"

2. **Verify your `.gitignore` excludes secrets:**
   - Open `D:\apps\catmd\.gitignore` in a text editor
   - Make sure these lines exist (add if missing):
     ```
     # Secrets — never commit
     .env
     .env.local
     .env.*.local
     ~/.openclaw/secrets/
     keys.env
     **/secrets/

     # OpenClaw runtime state
     .openclaw/
     ~/.openclaw/

     # Node / Expo
     node_modules/
     dist/
     .expo/

     # macOS / Windows artifacts
     .DS_Store
     Thumbs.db
     ```

3. **Commit current state on Windows:**
   ```bash
   cd D:\apps\catmd
   git add .
   git commit -m "OpenClaw kit + marketing docs ready for Mac deploy"
   ```

4. **Add GitHub remote + push:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/catmd.git
   git branch -M main          # rename master to main if you prefer
   git push -u origin main
   ```

   GitHub will prompt for login. Use a personal access token (not your password — GitHub deprecated password auth in 2021):
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
   - Scope: `repo` (full repo access)
   - Copy the token → use as password when git push prompts

### Step A2 — Clone on Mac

On the Mac, open Terminal:

```bash
# 1. Make a dev directory
mkdir -p ~/dev
cd ~/dev

# 2. Clone the repo
git clone https://github.com/YOUR_USERNAME/catmd.git
cd catmd

# 3. Verify the marketing/openclaw/ folder is there
ls -la marketing/openclaw/
# Expected: README.md, DEPLOY.sh, MCP-INTEGRATION-SPEC.md, MAC-SETUP.md, workspace/
```

### Step A3 — Ongoing sync workflow

After first setup, any time you make changes on Windows:

```bash
# On Windows
cd D:\apps\catmd
git add .
git commit -m "describe what you changed"
git push
```

Then on Mac:

```bash
cd ~/dev/catmd
git pull

# If you also changed DEPLOY.sh or any workspace file, re-run deploy:
./marketing/openclaw/DEPLOY.sh
```

If you make changes on Mac (e.g., bot writes to memory/), commit + push from Mac so Windows stays in sync. Standard git workflow.

---

## Path B — Direct copy (no Git)

Pick the sub-path that matches your situation:

### B1 — Cloud sync folder (Dropbox / iCloud / Google Drive)

1. On Windows: copy `D:\apps\catmd\marketing\openclaw\` into your cloud-sync folder
2. Wait for sync (1-5 min depending on connection)
3. On Mac: copy the synced `openclaw/` folder to `~/dev/catmd/marketing/openclaw/`
4. **Caveat:** the bot's `memory/*.md` files write frequently. Cloud-sync conflicts are real. Recommend NOT keeping the live bot folder in cloud sync — only use this for the initial transfer.

### B2 — USB drive

1. On Windows: copy `D:\apps\catmd\` (or just `D:\apps\catmd\marketing\`) to USB drive
2. **Important: exclude `node_modules\`** — it's huge (~500MB+) and Mac will rebuild from scratch
3. Plug USB into Mac
4. `cp -r /Volumes/USB_NAME/catmd ~/dev/catmd`

### B3 — rsync over LAN (if both machines on same network)

On Windows, you'll need OpenSSH (built into Windows 10+). On Mac, SSH is built in.

```bash
# On Mac, find your IP
ifconfig | grep inet
# Note your local IP, e.g., 192.168.1.42

# On Windows (PowerShell)
rsync -avz --exclude='node_modules' --exclude='.expo' --exclude='dist' \
  D:/apps/catmd/ \
  amit@192.168.1.42:~/dev/catmd/
```

Type your Mac password when prompted.

---

## Mac install prerequisites (~30 min)

After you have the catmd folder on Mac, install the runtime stack:

### Step M1 — Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH (Apple Silicon)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Step M2 — Node + Git (if not installed)

```bash
brew install node git
node -v   # should be v20+ for OpenClaw
git --version
```

### Step M3 — LM Studio

```bash
brew install --cask lm-studio
```

**First launch — Gatekeeper warning:**
- macOS may block LM Studio because it's not from the App Store
- Open Finder → Applications → right-click LM Studio → Open → Open anyway
- After this once, future launches work normally

### Step M4 — Download Qwen 3.6-35B-A3B model in LM Studio

1. Open LM Studio
2. Go to **Discover** tab (left sidebar magnifying glass)
3. Search: `Qwen3-35B-A3B`
4. Pick: **mlx-community/Qwen3-35B-A3B-Instruct-Q5** (note: MLX format = Apple Silicon optimized, faster than GGUF)
5. Click Download (~25GB — takes 5-15 min on a decent connection)
6. Once downloaded, go to **Chat** tab → "Select a model to load" → pick the Qwen model
7. **Wait for load** (~30 sec first time)

### Step M5 — Start LM Studio API server

1. In LM Studio, click **Local Server** tab (left sidebar, usually icon looks like a server)
2. Toggle **Start Server** ON
3. Confirm endpoint: `http://localhost:1234/v1`
4. Toggle ON: **"Run server when LM Studio starts"** AND **"Start LM Studio on system startup"** (System Preferences → Login Items → Add LM Studio)

### Step M6 — Verify LM Studio responds

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-35b-a3b-instruct-q5",
    "messages": [{"role": "user", "content": "say hello in cat voice — 1 sentence, dry-aristocratic register"}]
  }'
```

Expected: a JSON response with content like *"Morning. Try not to embarrass the family."* If you get an error, troubleshoot LM Studio before moving on.

### Step M7 — OpenClaw

```bash
npm install -g openclaw

# First time — initialize workspace
openclaw init
```

This creates `~/.openclaw/` with default config. You'll overwrite the workspace contents with your CatMD kit in the next step.

---

## Run the deploy script

```bash
cd ~/dev/catmd
chmod +x marketing/openclaw/DEPLOY.sh
./marketing/openclaw/DEPLOY.sh
```

The script will:
1. Verify prerequisites (Apple Silicon, RAM ≥ 64GB, Node, Homebrew)
2. Confirm LM Studio API responding
3. Confirm OpenClaw installed
4. Back up any existing OpenClaw workspace (timestamped `.bak`)
5. Copy `marketing/openclaw/workspace/*` to `~/.openclaw/workspace/`
6. Configure model provider (Qwen at localhost:1234)
7. Run smoke tests (model responds, files present)
8. Install daemon (auto-start on boot)
9. Save deploy state marker (so bot knows it's pre-launch vs launch-day)

**The script is idempotent** — safe to re-run after pulling updates from Windows.

---

## First-time secrets configuration

Before the bot can do useful work, set up `~/.openclaw/secrets/keys.env`. Per `MCP-INTEGRATION-SPEC.md`:

```bash
mkdir -p ~/.openclaw/secrets
chmod 700 ~/.openclaw/secrets

# Open keys.env in your editor
nano ~/.openclaw/secrets/keys.env
```

Paste in (filling in your actual keys):

```bash
# Tier 1 — required for launch
POSTHOG_API_KEY=phc_...
POSTHOG_PROJECT_ID=12345
POSTHOG_HOST=https://app.posthog.com

REVENUECAT_API_KEY=rc_...
REVENUECAT_PROJECT_ID=...

SLACK_BOT_TOKEN=xoxb-...
SLACK_USER_ID=U...

REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USERNAME=...
REDDIT_PASSWORD=...

FAL_KEY=fal-ai-...
FAL_WEEKLY_CAP=5

# Tier 2 — within first week post-deploy
PLAY_CONSOLE_SERVICE_ACCOUNT=/Users/YOUR_USER/.openclaw/secrets/play-console.json

# Tier 3 — post-launch / when ready
# APP_STORE_KEY_ID=...
# APP_STORE_ISSUER_ID=...
# X_API_KEY=...           # Skip until MRR > $1K
```

```bash
chmod 600 ~/.openclaw/secrets/keys.env
```

Where to get each: see `marketing/openclaw/MCP-INTEGRATION-SPEC.md` § per-tool sections.

---

## Smoke tests

Run these in order. If any fails, troubleshoot before moving on:

### Test 1 — OpenClaw responds

```bash
openclaw chat
```

Type: `hey ReddyTheBot, draft a comment for this URL: https://reddit.com/r/CatAdvice/example`

Expected: a 2-4 sentence draft comment appears in the cat-owner voice register. (It may say it can't fetch the URL since Reddit access isn't configured yet — that's fine. Verify the bot understood the request structure.)

### Test 2 — Workspace files visible

```bash
ls -la ~/.openclaw/workspace/
ls -la ~/.openclaw/workspace/skills/
ls -la ~/.openclaw/workspace/knowledge/
ls -la ~/.openclaw/workspace/memory/
```

Expected: SOUL.md, IDENTITY.md, AGENTS.md, TOOLS.md, HEARTBEAT.md visible at top level + 12 skills + 2 knowledge files + 3 memory files.

### Test 3 — Daemon registered

```bash
launchctl list | grep openclaw
```

Expected: a line showing the OpenClaw service registered with macOS launchd.

### Test 4 — Slack notification (if Slack token in keys.env)

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $(grep SLACK_BOT_TOKEN ~/.openclaw/secrets/keys.env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"channel": "USER_ID_HERE", "text": "smoke test from CatMD bot"}'
```

Expected: you receive a DM in Slack.

### Test 5 — Reddit OAuth (if Reddit creds in keys.env)

```bash
# (More complex test; OpenClaw should handle this internally on first daemon run)
openclaw daemon restart
tail -f ~/.openclaw/logs/openclaw.log
```

Expected: log shows successful Reddit OAuth handshake within 30 sec.

---

## Common gotchas

| Issue | Fix |
|---|---|
| LM Studio won't open ("can't be opened because it's from an unidentified developer") | Right-click in Finder → Open → Open anyway. macOS Gatekeeper one-time bypass. |
| `npm install -g openclaw` fails with EACCES | `sudo npm install -g openclaw` OR fix npm prefix per [npm docs] (`npm config set prefix ~/.npm-global`) |
| LM Studio model loads but server doesn't start | LM Studio → Local Server → make sure "Start Server" is ON. Some macOS versions block port 1234 — use port 1234 explicitly or pick another. |
| OpenClaw daemon won't start | Check `~/.openclaw/logs/openclaw.log` for stack trace. Common: missing keys.env file. |
| Memory pressure under load (Mac slows down) | Reduce LM Studio context window in config (256K → 64K) — saves ~6GB RAM |
| Git push fails with "remote rejected" | Did you set `.gitignore` to exclude secrets? GitHub may reject if it detects committed secrets. |
| Pull on Mac shows merge conflicts | Bot may have written to memory/ on Mac while you edited on Windows. Resolve manually — usually keep Mac's version since it's closer to live state. |
| File permissions weird (everything chmod 600) | Run `chmod -R u+r,go-rwx ~/.openclaw/secrets/` then `chmod 600 ~/.openclaw/secrets/keys.env` |

---

## Path C — Hybrid (work on Windows, deploy on Mac)

Recommended ongoing workflow:

| Activity | Where |
|---|---|
| Edit marketing strategy docs (`MARKETING-STRATEGY-MOONSHOT.md`, etc.) | **Windows** (your main dev machine) |
| Edit OpenClaw kit files (skills, SOUL.md, etc.) | **Windows** |
| Run the bot 24/7 | **Mac** (dedicated to the bot) |
| Receive daily digests, approve drafts | **Mac → Slack DMs to your phone** |
| Edit memory/ files (sprint-state, learnings) | **Mac** (bot writes here; you don't touch unless intervening) |

To sync Windows changes to Mac:
1. `git push` on Windows
2. `git pull` on Mac
3. Re-run `./marketing/openclaw/DEPLOY.sh` if any workspace file changed
4. `openclaw daemon restart` to pick up new config

Mac changes should be infrequent — only commit memory/ files weekly when something significant has been logged.

---

## Quickstart cheatsheet

If everything is set up and you just want the boot sequence:

```bash
# On Mac, on launch eve (D14, Thu May 14)
cd ~/dev/catmd
git pull
./marketing/openclaw/DEPLOY.sh

# On launch morning (Fri May 15, ~5 AM PT)
openclaw daemon restart
# Drop Video #1 manually per LAUNCH-DAY-PLAYBOOK.md
# Bot detects launch-day trigger, autonomous mode activates

# Daily — what you'll do on launch day onward
# Just check Slack DMs from the bot, approve/edit/skip drafts
```

---

## Total cost summary

| Item | Cost |
|---|---|
| GitHub private repo | Free (Free tier covers private repos under 100MB) |
| Homebrew, Node, Git, LM Studio, OpenClaw | $0 |
| Qwen 3.6-35B-A3B model weights | $0 |
| Mac Studio electricity (already owned) | ~$3-5/month |
| Cloud Claude Sonnet escalation (Tier-1 press only) | ~$15-30/month |
| **Total ongoing** | **~$20-35/month** |

---

## Changelog

| Date | Update |
|---|---|
| 2026-05-07 | Initial. Path A (Git) recommended; Paths B (direct copy) + C (hybrid workflow) documented. Mac install steps cover Apple Silicon Gatekeeper, LM Studio MLX setup, OpenClaw daemon registration. Common gotchas and quickstart cheatsheet for launch eve. |
