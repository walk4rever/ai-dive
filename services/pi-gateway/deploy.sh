#!/usr/bin/env bash
# Deploy pi-gateway-ai-dive to air7.
# Usage: ./deploy.sh [--restart-only]
# Run from anywhere inside the ai-dive repo.
#
# ── FIRST-TIME SETUP ON AIR7 ──────────────────────────────────────────────────
# 1. SSH in and create /root/pi-gateway-ai-dive/.env (see .env.example):
#      ssh air7
#      mkdir -p /root/pi-gateway-ai-dive
#      nano /root/pi-gateway-ai-dive/.env
#    Required values:
#      DIRECT_URL = Supabase direct postgres URL (vlaawtpxqzclhmhrlwti project)
#      AGENT_SECRET = 904e130c5404006a463ef6d2e6b27e315dbc44612abb7ef6
#      PI_AGENT_DIR = /root/pi-gateway-ai-dive/.pi-agent
#      PORT = 3457
#
# 2. After first deploy, fill in the DeepSeek API key:
#      nano /root/pi-gateway-ai-dive/.pi-agent/models.json
#    Replace FILL_IN_DEEPSEEK_API_KEY with the actual key.
#
# 3. Add nginx reverse proxy (if using relay.air7.fun):
#    location /pi-ai-dive/ {
#      proxy_pass http://127.0.0.1:3457/;
#      proxy_http_version 1.1;
#      proxy_set_header Connection '';
#      proxy_buffering off;
#      proxy_cache off;
#      chunked_transfer_encoding on;
#    }
#    Then update AI_DIVE_AGENT_GATEWAY_URL in ai-dive's .env.local to:
#      https://relay.air7.fun/pi-ai-dive
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REMOTE="air7"
REMOTE_DIR="/root/pi-gateway-ai-dive"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RESTART_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--restart-only" ]] && RESTART_ONLY=true
done

if [[ "$RESTART_ONLY" == false ]]; then
  echo "→ Syncing files to ${REMOTE}:${REMOTE_DIR} ..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='*.log' \
    "${SCRIPT_DIR}/" "${REMOTE}:${REMOTE_DIR}/"

  echo "→ Installing dependencies ..."
  ssh "$REMOTE" "cd ${REMOTE_DIR} && npm install --omit=dev --ignore-scripts"
fi

echo "→ Restarting pi-gateway-ai-dive via PM2 ..."
ssh "$REMOTE" "pm2 restart pi-gateway-ai-dive --update-env || pm2 start ${REMOTE_DIR}/ecosystem.config.cjs"

echo "→ Status:"
ssh "$REMOTE" "pm2 show pi-gateway-ai-dive | grep -E 'status|uptime|restarts|pid'"

echo ""
echo "✓ Deploy complete. Gateway running at air7:3457"
