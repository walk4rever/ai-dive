#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-air7}"
REMOTE_DIR="${REMOTE_DIR:-/root/ai-dive}"
REMOTE_ENV_FILE="${REMOTE_ENV_FILE:-$REMOTE_DIR/.env.local}"

if [[ ! -f ".env.local" ]]; then
  echo "Missing local .env.local"
  exit 1
fi

echo "[1/5] Prepare remote directory: $REMOTE_HOST:$REMOTE_DIR"
ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR/logs'"

echo "[2/5] Rsync worker files"
rsync -az \
  package.json \
  package-lock.json \
  ecosystem.score.config.cjs \
  .env.local \
  scripts/score-signals-v1.mjs \
  "$REMOTE_HOST:$REMOTE_DIR/"

echo "[3/5] Install dependencies on remote"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && npm ci --omit=dev"

echo "[4/5] Ensure runtime env file"
ssh "$REMOTE_HOST" "cp '$REMOTE_DIR/.env.local' '$REMOTE_ENV_FILE'"

echo "[5/5] Start or reload pm2 cron apps"
ssh "$REMOTE_HOST" "cd '$REMOTE_DIR' && pm2 start ecosystem.score.config.cjs --update-env && pm2 save"

echo "Done."
echo "Check status with: ssh $REMOTE_HOST 'pm2 ls && pm2 logs score-signals-v1-hourly --lines 100'"
