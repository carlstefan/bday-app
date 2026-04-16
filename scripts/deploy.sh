#!/usr/bin/env bash
# deploy.sh — pull latest, rebuild, restart
# Run from the repo root on the VPS

set -euo pipefail

echo "==> Pulling latest code…"
git pull origin main

echo "==> Building and restarting containers…"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build --remove-orphans

echo "==> Cleaning up dangling images…"
docker image prune -f

echo "==> Deploy complete."
docker compose ps
