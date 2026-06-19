# Akademi Recovery Playbook

## Health endpoints

- `GET /live`
  - basic liveness probe
- `GET /ready`
  - readiness probe for traffic and deploy checks
- `GET /health`
  - full dependency snapshot with runtime and recovery posture

## Dependency expectations

### Database

- Managed Postgres backups must be enabled at the hosting provider.
- Point-in-time recovery should be enabled where the provider supports it.
- Restore access should be limited to trusted operators.

### Redis

- Redis is used for rate limiting, monitoring persistence, and runtime coordination.
- If Redis is unavailable, the API can start in degraded mode and fail open for non-critical cache/rate-limit paths.

### Object storage

- Cloudflare R2 should be treated as durable storage, not as the only recovery source.
- Enable versioning or bucket replication outside the application where possible.

## Restore plan

1. Restore the latest known-good database snapshot into an isolated environment.
2. Validate auth, materials, questions, payments, and admin tables before cutting over.
3. Repoint the application to the restored database only after validation completes.
4. Re-run ingestion or question-generation jobs for any materials whose derived content is missing.
5. Restore the object bucket from versioned backups or a mirrored bucket if source files were lost.
6. Mark any unrecoverable materials clearly and notify affected admins/users.

## Graceful degradation expectations

- If Redis is degraded:
  - rate limiting and monitoring persistence may fail open or fall back
  - health endpoints should report degraded mode clearly
- If queue processing fails:
  - uploads should confirm receipt but explain that processing is delayed
- If storage is unavailable:
  - uploads/downloads should return a clear storage availability error

## Shutdown expectations

- On `SIGTERM` or `SIGINT`, the app should:
  - stop recurring schedulers
  - close websocket connections
  - stop queue activity
  - close the HTTP server
  - disconnect Redis and Prisma
