#!/usr/bin/env bash
# Деплой «Десятки» на trader-vps (Caddy, /var/www/desyatka).
# Использование: ./scripts/deploy.sh
# A/B-вариант «Дюжина» живёт в ../dyuzhina (та же кодовая база, VITE_CHAIN_TARGET=12).
set -euo pipefail
cd "$(dirname "$0")/.."

VITE_CHAIN_TARGET=10 VITE_BOT_URL=https://t.me/tennishgame_bot npm run build
rsync -az --delete dist/ trader-vps:/var/www/desyatka/
ssh trader-vps 'chown -R caddy:caddy /var/www/desyatka'
echo "Deployed: https://207-148-119-174.sslip.io/"
