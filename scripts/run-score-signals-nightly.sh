#!/usr/bin/env bash
set -euo pipefail
cd /root/ai-dive
set -a
source .env.local
set +a
npm run score:signals:v1 -- --force --limit 2000

