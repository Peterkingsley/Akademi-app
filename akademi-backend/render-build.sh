#!/usr/bin/env bash
set -o errexit

# Existing steps — unchanged from the current Build Command
npm install

# New: ensure Chrome is actually installed and its cache persists
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR
npx puppeteer browsers install chrome

if [[ ! -d $PUPPETEER_CACHE_DIR ]]; then
  echo "...Copying Puppeteer Cache from Build Cache"
  cp -R /opt/render/project/src/.cache/puppeteer/chrome/ $PUPPETEER_CACHE_DIR
else
  echo "...Storing Puppeteer Cache in Build Cache"
  cp -R $PUPPETEER_CACHE_DIR /opt/render/project/src/.cache/puppeteer/chrome/
fi

# Existing steps — unchanged, must still run after this
npm run build
npx prisma migrate deploy
