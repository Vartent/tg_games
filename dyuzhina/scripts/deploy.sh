#!/usr/bin/env bash
# Деплой «Дюжины» (A/B-вариант «Десятки», цель 12) на trader-vps (Caddy, /var/www/dyuzhina).
# Использование: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

VITE_BOT_URL=https://t.me/even_dozen_bot npm run build
rsync -az --delete dist/ trader-vps:/var/www/dyuzhina/
ssh trader-vps 'chown -R caddy:caddy /var/www/dyuzhina'
echo "Deployed: https://dyuzhina.207-148-119-174.sslip.io/"
