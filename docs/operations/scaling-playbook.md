# Akademi Scaling Playbook

## Target topology

- `api` service
  - handles REST traffic
  - safe to scale horizontally
- `websocket` service
  - handles realtime socket traffic
  - should use the Redis adapter when more than one instance is active
- `jobs` service
  - handles scheduled/background work
  - should remain single-replica until distributed job locking is introduced

## Load balancing posture

- Socket clients now use **websocket-only** transport.
- This avoids the sticky-session requirement that Engine.IO polling introduces behind a load balancer.
- If polling is reintroduced later, sticky sessions must be enabled at the load balancer.

## Horizontal scaling rules

### API

- Multiple API replicas are allowed.
- Do not run recurring schedulers on API replicas.
- Keep health/readiness probes attached to `/live` and `/ready`.

### WebSocket

- Multiple websocket replicas require:
  - Redis online
  - `ENABLE_WEBSOCKET_REDIS_ADAPTER=true`
- Without the adapter, websocket replicas are not safe for cross-instance fan-out.

### Jobs

- Keep one jobs replica for now.
- Before scaling jobs horizontally, introduce distributed locking or a real queue/worker model.

## Recommended env posture

```env
SERVICE_TYPE=api|websocket|jobs
ENABLE_REDIS=true
ENABLE_WEBSOCKET_REDIS_ADAPTER=true   # websocket service only when scaled
```

## Operational checks before scaling

1. Confirm `/health` shows Redis `online`.
2. Confirm `/health` scaling section shows no blockers.
3. Confirm admin system monitoring shows:
   - queue healthy
   - websocket adapter state expected for service type
4. Scale API first, websocket second, jobs last.
