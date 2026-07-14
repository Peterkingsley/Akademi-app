# Akademi

Akademi is an AI-powered personalized academic companion app built for Nigerian public university students — helping them organize coursework, get tutored through problem sets, and prepare for exams.

## Repository layout

This repo hosts several independent apps that make up the Akademi product:

| Directory | What it is |
| --- | --- |
| [`akademi-backend`](./akademi-backend) | Node.js/TypeScript API — Express, Prisma/PostgreSQL, Redis, Typesense. See its [README](./akademi-backend/README.md) for setup. |
| [`akademi-frontend`](./akademi-frontend) | React Native (Expo) mobile app. |
| [`akademi-waitlist`](./akademi-waitlist) | Static landing page for the beta waitlist. |
| [`akademi-motion-video`](./akademi-motion-video) | Remotion project for the launch promo video. |
| [`scraper`](./scraper) | Scripts that build the Nigerian tertiary-institution and course datasets used to seed the backend. |
| [`docs/operations`](./docs/operations) | Recovery, scaling, and CI/CD guardrail playbooks. |

## Getting started

Each app is set up and run independently — see the README inside each directory for prerequisites and commands. Start with [`akademi-backend/README.md`](./akademi-backend/README.md) if you're standing up the API locally.

## CI

Pull requests run backend and frontend typechecks via GitHub Actions (`.github/workflows/ci.yml`), plus a Render build-contract check (`.github/workflows/render-safety.yml`) that validates the production build/migration path for backend changes.
