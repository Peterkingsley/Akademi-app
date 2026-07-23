#!/usr/bin/env bash
set -o errexit

# Existing steps — unchanged from the current Build Command
npm install

# Render does NOT carry anything under $HOME/.cache (/opt/render/.cache)
# from the build environment into the running deployment — only the
# project directory itself survives that transition. Installing Chrome
# outside the project directory is why it kept "disappearing" at runtime
# even after a successful build. Install it inside the project instead.
export PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer
npx puppeteer browsers install chrome

# Existing steps — unchanged, must still run after this
npm run build
npx prisma migrate deploy
