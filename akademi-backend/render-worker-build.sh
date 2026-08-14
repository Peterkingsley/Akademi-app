#!/usr/bin/env bash
set -o errexit

npm install

export PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer
npx puppeteer browsers install chrome

npm run build
