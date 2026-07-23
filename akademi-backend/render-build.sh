#!/usr/bin/env bash
set -o errexit

# Existing steps — unchanged from the current Build Command
npm install

# New: ensure Chrome is installed at the path Puppeteer expects at runtime,
# and persist it inside the project directory so Render's own build cache
# picks it up automatically on future deploys (avoids redownloading Chrome
# — a large binary — on every single build).
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
PROJECT_CACHE_DIR=/opt/render/project/src/.cache/puppeteer

mkdir -p "$PUPPETEER_CACHE_DIR"

if [ -d "$PROJECT_CACHE_DIR/chrome" ] && [ "$(ls -A "$PROJECT_CACHE_DIR/chrome" 2>/dev/null)" ]; then
  echo "...Restoring Puppeteer Chrome from project cache"
  cp -R "$PROJECT_CACHE_DIR/chrome/." "$PUPPETEER_CACHE_DIR/"
else
  echo "...No cached Chrome found, installing fresh"
  npx puppeteer browsers install chrome
  mkdir -p "$PROJECT_CACHE_DIR/chrome"
  cp -R "$PUPPETEER_CACHE_DIR/." "$PROJECT_CACHE_DIR/chrome/"
fi

# Existing steps — unchanged, must still run after this
npm run build
npx prisma migrate deploy
