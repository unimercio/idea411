#!/usr/bin/env bash
# VPS-side deploy script. Triggered over SSH by .github/workflows/deploy-vps.yml.
# Assumes: Node 20+, bun, pm2 already installed and on PATH for the deploy user,
# and that the repo lives at the path configured in VPS_APP_DIR.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies"
bun install --frozen-lockfile

echo "==> Building (node-server preset)"
NITRO_PRESET=node-server bun run build

echo "==> Reloading PM2 process"
if pm2 describe idea411 >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "==> Done"
