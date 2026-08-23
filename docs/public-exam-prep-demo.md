# Public guided Exam Prep demo

## Purpose

`/try` lets an anonymous visitor use the real guided Exam Prep feedback engine
before joining the Akademi waitlist. It is intentionally separate from the
authenticated `/exam-prep` API and does not create a user, permanent learning
session, or question-attempt record.

## Public routes

- `/try`
- `/try/exam-prep` (rewrites to the same current experience)
- `/try?course=PHY101` (prefills the material search; it does not bypass the
  controlled catalog)

The static Render rules are in `akademi-waitlist/_redirects`.

## API

- `GET /demo/exam-prep/materials`
- `POST /demo/exam-prep/sessions`
- `GET /demo/exam-prep/sessions/:sessionId`
- `POST /demo/exam-prep/sessions/:sessionId/questions/:questionId/submit`
- `POST /demo/exam-prep/sessions/:sessionId/questions/:questionId/retry`
- `POST /demo/exam-prep/sessions/:sessionId/next`

The existing `/exam-prep` router still applies authentication and the normal
authenticated rate limit before every route.

## Enabling materials

Set `DEMO_EXAM_PREP_MATERIAL_IDS` on the backend service to a comma-separated
list of exact material UUIDs. A listed material is returned only when it is:

- verified;
- currently published;
- Akademi-generated; and
- backed by at least the configured number of usable four-option questions.

The default is an empty allowlist, which safely disables the public catalog.
Use database IDs rather than course codes so similarly named private or
student-uploaded materials cannot be enumerated accidentally.

## Anonymous session lifecycle

Sessions use cryptographically random UUIDs as opaque bearer references. State
is stored in Redis under `demo:exam-prep:session:*` with a 45-minute TTL that
refreshes when demo progress changes. A bounded in-process fallback keeps a single API instance usable if
Redis is temporarily unavailable; Redis remains required for reliable
multi-instance continuity. Expired references receive HTTP 410 and public-safe
copy.

Stored demo state contains material/question IDs, progress, the learner's
reasoning, and returned feedback. It is not attached to a user account and is
not written to Prisma session or attempt tables.

## Retry matching

The retry branch only searches unused questions from the same approved
material. It ranks candidates using:

1. overlapping verified source-page ranges;
2. the same question type;
3. the same difficulty; and
4. semantic similarity between the source question, its approach guide, and
   the feedback's key concept, recommendation, topics, and misconception.

The public layer does not generate a generic question when no match exists. It
returns a constructive unavailable response and leaves the normal Continue
path usable.

## Limits and abuse controls

Defaults:

- 3 evaluated questions per demo;
- 45-minute anonymous session TTL;
- 12 questions loaded into the bounded candidate pool;
- 8 new demo sessions per IP per hour;
- 30 submit/retry/next requests per IP per hour; and
- 90 total demo API requests per IP per 15 minutes.

Correct answers, canonical explanations, source text, and prompts never appear
in a pre-submission response. Correctness is resolved on the server. Reasoning
is limited to 2,000 characters, source context to 8,000 characters, and a
submission lock plus idempotent stored attempts prevents repeated model usage
for the same question.

## Configuration

- `DEMO_EXAM_PREP_MATERIAL_IDS` (default empty)
- `DEMO_EXAM_PREP_QUESTION_LIMIT` (default 3, bounded 1-5)
- `DEMO_EXAM_PREP_SESSION_TTL_SECONDS` (default 2700, bounded 1800-3600)
- `DEMO_EXAM_PREP_QUESTION_POOL_SIZE` (default 12, bounded 5-30)

The waitlist web origin must remain in the backend CORS allowlist. Current
Akademi production origins are already included in the shared CORS helper.

## Analytics

The demo reuses the first-party waitlist event endpoint and stores these funnel
events in `waitlist_events`:

- `try_page_viewed`
- `demo_material_selected`
- `demo_question_answered`
- `demo_reasoning_submitted`
- `demo_feedback_viewed`
- `demo_retry_yes`
- `demo_retry_no`
- `demo_completed`
- `demo_conversion_clicked`

Analytics failures never block the demo.

## Deployment

Redeploy `akademi-backend` and the `akademi-waitlist` static site. Configure
the material allowlist on the backend before announcing the route. No Prisma
migration, worker redeploy, or mobile application release is required for this
feature.
