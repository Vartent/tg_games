#!/usr/bin/env bash
# Деплой «Трио» на trader-vps (Caddy, /var/www/trio).
# Использование: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VITE_BOT_URL=https://t.me/ten_thirds_bot npm run build
rsync -az --delete dist/ trader-vps:/var/www/trio/
ssh trader-vps 'chown -R caddy:caddy /var/www/trio'
echo "Deployed: https://trio.207-148-119-174.sslip.io/"
