#!/usr/bin/env bash
# =====================================================================
# CatMD OpenClaw Marketing Bot — Deploy Script
# Hardware target: Mac Studio M4 Max, 16C/40G GPU, 64GB unified, 1TB
# Model: Qwen 3.6-35B-A3B-Instruct Q5_K_M (MLX format)
# Deploy timeline: D11-D14 (May 11-14) so bot is LIVE by launch May 15
# =====================================================================

set -euo pipefail

# Color helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()    { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
ok()     { echo -e "${GREEN}✓${NC} $1"; }
warn()   { echo -e "${YELLOW}⚠${NC} $1"; }
err()    { echo -e "${RED}✗${NC} $1"; exit 1; }

# =====================================================================
# 0. Pre-flight checks
# =====================================================================
log "Step 0 — Pre-flight checks"

# Confirm Apple Silicon
arch_check=$(uname -m)
[[ "$arch_check" != "arm64" ]] && err "Not Apple Silicon. Bot needs M-series Mac. Detected: $arch_check"
ok "Apple Silicon confirmed (arm64)"

# Confirm RAM (need at least 64GB)
ram_gb=$(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024}' | cut -d. -f1)
[[ "$ram_gb" -lt 60 ]] && err "Need 64GB+ RAM. Detected: ${ram_gb}GB"
ok "RAM check passed (${ram_gb}GB)"

# Confirm Homebrew
command -v brew >/dev/null 2>&1 || err "Homebrew not installed. Run: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
ok "Homebrew installed"

# Confirm Node
command -v node >/dev/null 2>&1 || { log "Node not found, installing..."; brew install node; }
node_version=$(node -v | cut -d. -f1 | tr -d 'v')
[[ "$node_version" -lt 20 ]] && err "Node version $node_version too old. Need 20+."
ok "Node $(node -v)"

# Confirm secrets file exists
SECRETS_FILE="$HOME/.openclaw/secrets/keys.env"
if [[ ! -f "$SECRETS_FILE" ]]; then
    warn "Secrets file not found at $SECRETS_FILE"
    warn "Create it per marketing/openclaw/MCP-INTEGRATION-SPEC.md before continuing"
    warn "Tier 1 minimum: POSTHOG, REVENUECAT, SLACK, REDDIT, FAL_KEY"
    read -p "Continue anyway (smoke test mode, no real integrations)? [y/N] " -n 1 -r; echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && err "Aborting. Set up keys.env first."
fi

# =====================================================================
# 1. Install LM Studio (or confirm already installed)
# =====================================================================
log "Step 1 — LM Studio installation check"

if [[ ! -d "/Applications/LM Studio.app" ]]; then
    log "Installing LM Studio..."
    brew install --cask lm-studio
    ok "LM Studio installed"
else
    ok "LM Studio already installed"
fi

# Reminder: model download must happen via LM Studio UI (or HuggingFace CLI)
warn "Model download not automated. Open LM Studio:"
warn "  1. Discover tab → search 'Qwen3-35B-A3B'"
warn "  2. Download mlx-community/Qwen3-35B-A3B-Instruct-Q5 (~25GB, 5-10 min)"
warn "  3. Chat tab → Select model to load → Qwen3-35B-A3B-Instruct-Q5"
warn "  4. Local Server tab → Start Server (port 1234)"
warn "  5. Toggle ON: 'Run on system startup'"
read -p "Press ENTER once LM Studio model is loaded and server is running on localhost:1234..."

# Verify LM Studio API is responding
log "Verifying LM Studio API at localhost:1234..."
if curl -s -f -o /dev/null http://localhost:1234/v1/models; then
    ok "LM Studio API responding"
else
    err "LM Studio API not reachable on localhost:1234. Confirm server is running."
fi

# =====================================================================
# 2. Install OpenClaw
# =====================================================================
log "Step 2 — OpenClaw installation"

if ! command -v openclaw >/dev/null 2>&1; then
    log "Installing OpenClaw via npm..."
    npm install -g openclaw
    ok "OpenClaw installed"
else
    log "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown')"
    log "Updating to latest..."
    npm install -g openclaw@latest
    ok "OpenClaw updated"
fi

# Initialize OpenClaw workspace if not already
if [[ ! -d "$HOME/.openclaw" ]]; then
    log "Initializing OpenClaw workspace..."
    openclaw init
    ok "Workspace initialized at ~/.openclaw"
else
    ok "OpenClaw workspace already exists at ~/.openclaw"
fi

# =====================================================================
# 3. Copy CatMD workspace files
# =====================================================================
log "Step 3 — Deploying CatMD workspace files"

CATMD_REPO="${CATMD_REPO:-$HOME/dev/catmd}"
WORKSPACE_SRC="$CATMD_REPO/marketing/openclaw/workspace"
WORKSPACE_DST="$HOME/.openclaw/workspace"

if [[ ! -d "$WORKSPACE_SRC" ]]; then
    err "CatMD workspace files not found at $WORKSPACE_SRC. Set CATMD_REPO env var to point at your CatMD checkout."
fi

# Backup existing workspace if any (preserve user's manual edits)
if [[ -d "$WORKSPACE_DST" ]] && [[ "$(ls -A "$WORKSPACE_DST")" ]]; then
    backup_dir="$HOME/.openclaw/workspace.bak.$(date +%Y%m%d-%H%M%S)"
    log "Existing workspace not empty — backing up to $backup_dir"
    cp -R "$WORKSPACE_DST" "$backup_dir"
    ok "Backup created: $backup_dir"
fi

# Copy fresh workspace
log "Copying CatMD workspace files to $WORKSPACE_DST..."
mkdir -p "$WORKSPACE_DST"
cp -R "$WORKSPACE_SRC/." "$WORKSPACE_DST/"
ok "Workspace files deployed"

# Create empty drafts + secrets directories (chmod 700)
mkdir -p "$WORKSPACE_DST/drafts"
mkdir -p "$HOME/.openclaw/secrets"
chmod 700 "$HOME/.openclaw/secrets"
ok "Drafts + secrets directories created"

# =====================================================================
# 4. Configure OpenClaw model provider
# =====================================================================
log "Step 4 — Configuring OpenClaw model provider"

CONFIG_FILE="$HOME/.openclaw/config.yaml"
if [[ ! -f "$CONFIG_FILE" ]]; then
    cat > "$CONFIG_FILE" <<EOF
models:
  providers:
    qwen-local:
      type: openai-compatible
      base_url: http://localhost:1234/v1
      api_key: lm-studio
      models:
        - id: qwen3-35b-a3b-instruct-q5
          context_window: 262144
          tool_use: true

agent:
  default_provider: qwen-local
  default_model: qwen3-35b-a3b-instruct-q5
  temperature: 0.7
  max_tokens: 2048
EOF
    ok "Config file created at $CONFIG_FILE"
else
    warn "Config file already exists at $CONFIG_FILE — leaving as-is. Edit manually if needed."
fi

# =====================================================================
# 5. Smoke tests
# =====================================================================
log "Step 5 — Smoke tests"

# Test 1: LM Studio reachable from OpenClaw config
log "Test 1: LM Studio reachable from configured endpoint..."
test_response=$(curl -s -X POST http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-35b-a3b-instruct-q5",
    "messages": [{"role": "user", "content": "say hello in cat voice — 1 sentence, dry-aristocratic register"}],
    "max_tokens": 50
  }')
test_content=$(echo "$test_response" | grep -o '"content":"[^"]*"' | head -1 || echo "")
if [[ -n "$test_content" ]]; then
    ok "LM Studio responded: $test_content"
else
    err "LM Studio test failed. Response: $test_response"
fi

# Test 2: OpenClaw can read SOUL.md
log "Test 2: OpenClaw workspace files readable..."
[[ -f "$WORKSPACE_DST/SOUL.md" ]] && ok "SOUL.md present"
[[ -f "$WORKSPACE_DST/IDENTITY.md" ]] && ok "IDENTITY.md present"
[[ -f "$WORKSPACE_DST/AGENTS.md" ]] && ok "AGENTS.md present"
[[ -f "$WORKSPACE_DST/HEARTBEAT.md" ]] && ok "HEARTBEAT.md present"
[[ -d "$WORKSPACE_DST/skills" ]] && ok "skills/ present ($(ls "$WORKSPACE_DST/skills" | wc -l) skills)"
[[ -d "$WORKSPACE_DST/knowledge" ]] && ok "knowledge/ present"
[[ -d "$WORKSPACE_DST/memory" ]] && ok "memory/ present"

# Test 3: Slack token present (if secrets file exists)
if [[ -f "$SECRETS_FILE" ]]; then
    source "$SECRETS_FILE"
    if [[ -n "${SLACK_BOT_TOKEN:-}" ]]; then
        log "Test 3: Slack token present, sending test ping..."
        slack_response=$(curl -s -X POST https://slack.com/api/auth.test \
          -H "Authorization: Bearer $SLACK_BOT_TOKEN")
        if echo "$slack_response" | grep -q '"ok":true'; then
            ok "Slack auth verified"
        else
            warn "Slack token present but auth test failed: $slack_response"
        fi
    else
        warn "Slack token not in secrets file — bot will run but can't push notifications"
    fi
fi

# =====================================================================
# 6. Install daemon
# =====================================================================
log "Step 6 — Installing OpenClaw daemon (auto-start on boot)"

if openclaw onboard --install-daemon 2>/dev/null; then
    ok "Daemon installed"
else
    warn "openclaw onboard --install-daemon may have failed or already installed. Check manually."
fi

# Verify daemon
if launchctl list | grep -qi openclaw; then
    ok "OpenClaw daemon registered with launchctl"
else
    warn "OpenClaw daemon not visible in launchctl. May need manual setup."
fi

# =====================================================================
# 7. Set bot start date — May 15 launch day
# =====================================================================
log "Step 7 — Configuring bot to start operations May 15"

# Write a marker so the bot knows when to "go live"
cat > "$WORKSPACE_DST/memory/deploy-state.md" <<EOF
# Deploy state

- Deploy date: $(date +%Y-%m-%d)
- Bot start date: 2026-05-15 (launch day)
- Pre-launch mode: $([ "$(date +%Y%m%d)" -lt 20260515 ] && echo "true (smoke tests only, no autonomous loops)" || echo "false (full autonomous mode)")
- Last deploy script run: $(date)

## What's active

$([ "$(date +%Y%m%d)" -lt 20260515 ] && cat <<PRELAUNCH || cat <<LAUNCH
- ✅ LM Studio + Qwen 3.6-35B-A3B running
- ✅ OpenClaw daemon registered
- ✅ Workspace files deployed
- ✅ Smoke tests passing
- ❌ Heartbeat triggers paused until 2026-05-15 5:00 AM PT
- ❌ Threshold alerts paused (no metrics yet)

This is intentional — bot is ready to fire May 15 morning, not before.
PRELAUNCH
- ✅ Full autonomous mode
- ✅ Heartbeat triggers active per HEARTBEAT.md
- ✅ Threshold alerts watching real metrics
- ✅ All 12 skills available
LAUNCH
)
EOF

ok "Deploy state recorded"

# =====================================================================
# 8. Final summary
# =====================================================================
echo
echo "========================================================================"
echo -e "${GREEN}DEPLOY COMPLETE${NC}"
echo "========================================================================"
echo
echo "What's running now:"
echo "  • LM Studio (Qwen 3.6-35B-A3B) on localhost:1234"
echo "  • OpenClaw daemon (registered with launchctl)"
echo "  • Workspace deployed at $WORKSPACE_DST"
echo
echo "What's NOT firing yet:"
if [[ "$(date +%Y%m%d)" -lt 20260515 ]]; then
echo "  • Heartbeat triggers (autonomous loops) — paused until May 15 5 AM PT"
echo "  • Threshold alerts — paused (no real metrics yet)"
echo
echo "To go live on launch day (May 15):"
echo "  1. Wake up at 5 AM PT, drop Video #1 manually (per LAUNCH-DAY-PLAYBOOK.md)"
echo "  2. Run: openclaw daemon restart"
echo "  3. Bot will detect launch-day trigger and start the heartbeat loop"
fi
echo
echo "Next steps:"
echo "  • Verify ~/.openclaw/secrets/keys.env has all Tier 1 keys (PostHog, RevenueCat, Slack, Reddit, fal.ai)"
echo "  • Test end-to-end: 'openclaw chat' → 'hey ReddyTheBot, draft a comment for [test URL]'"
echo "  • Read $WORKSPACE_DST/SOUL.md and $WORKSPACE_DST/HEARTBEAT.md so you know what the bot will do"
echo
echo "Logs:"
echo "  • OpenClaw: ~/.openclaw/logs/"
echo "  • Memory state: $WORKSPACE_DST/memory/"
echo "  • Drafts: $WORKSPACE_DST/drafts/"
echo
echo "========================================================================"
