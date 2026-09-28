# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-09-28
**Phase:** Step 5 (Anomaly Detection + Incidents & Real Docker DB Verification) complete. Ready for Step 6 (Real-Time Layer).

## Completed
- [x] Full planning doc set (`prd.md` through `development-plan.md`) placed in `docs/`.
- [x] Step 1: Scaffold repository structure (backend, frontend, docker-compose).
- [x] Step 2: Auth + Org (`requirements.md` §1, `database.md` §2-3, `architecture.md` §5 & §7, `rules.md` §2 & §7):
  - Mongoose models: `Organization` & `User`.
  - Auth module: `AuthService`, `AuthController`, `auth.routes.ts`, `authenticate`, `requireRole`.
  - Frontend: `AuthContext`, `apiClient` with silent auto-refresh, `ProtectedRoute`, `LoginPage`, `SignupPage`.
- [x] Pre-Step 3 Check: Updated `docker-compose.yml` to configure single-node replica set `rs0` for MongoDB with automated healthcheck initiation so Mongoose transactions function out of the box in Docker environment.
- [x] Step 3: API Registry (`requirements.md` §2, `database.md` §4, `api.md` APIs table, `gen-design.md` §4):
  - Mongoose model: `Api`.
  - API Registry module: `ApisService` (CRUD with `organizationId` scoping), `ApisController`, `apis.routes.ts`.
  - Frontend: `DashboardPage` updated with dense Grafana/Linear style API table, overview summary strip, and `ApiModal` form.
- [x] Step 4: Worker + Scheduling (`requirements.md` §3, `database.md` §5, `architecture.md` §3B, `rules.md` §5, `workflows.md` Workflows 1 & 2):
  - Redis + BullMQ configuration in `src/config/redis.ts`.
  - Mongoose model `Check` with compound unique index `{ apiId: 1, scheduledTime: 1 }` (E11000 duplicate key explicitly caught & handled as an idempotent no-op).
  - Worker Scheduler ([`src/workers/scheduler.ts`](file:///d:/SentryWatch/backend/src/workers/scheduler.ts)) with boot reconciliation.
  - Worker process ([`src/workers/checkWorker.ts`](file:///d:/SentryWatch/backend/src/workers/checkWorker.ts)).
- [x] Step 5: Anomaly Detection + Incidents & Real DB Verification (`requirements.md` §4-5, `database.md` §6-7, `rules.md` §6 & §8, `workflows.md` Workflow 3):
  - Pure function `detectAnomaly` ([`src/modules/anomaly/detection.ts`](file:///d:/SentryWatch/backend/src/modules/anomaly/detection.ts)) with 100% branch-coverage unit test suite (`tests/anomaly.unit.test.ts`). Fixed 5-check window denominator and 5-check baseline guard.
  - Redis rolling-window helpers ([`src/modules/anomaly/rollingWindow.ts`](file:///d:/SentryWatch/backend/src/modules/anomaly/rollingWindow.ts)): maintains last 20 check metrics in `rolling:<apiId>` and manages consecutive anomaly counter `consecutive_anomaly:<apiId>`.
  - Mongoose model `Incident` ([`src/models/Incident.ts`](file:///d:/SentryWatch/backend/src/models/Incident.ts)) with embedded `IncidentEvent` array.
  - `IncidentsService` ([`src/modules/incidents/incidents.service.ts`](file:///d:/SentryWatch/backend/src/modules/incidents/incidents.service.ts)) enforcing valid lifecycle transitions (`detected->investigating`, `investigating->mitigated`, `mitigated->resolved`, `investigating->resolved`) and server-side resolve guard (requires API to pass last check).
  - **Real DB Verification (Docker Mongo + Redis):** Executed real health check pipeline against Docker MongoDB and Redis without mocks. Deleted mock narration scripts. Extracted raw MongoDB documents showing Check documents (`scheduledTime`, `executedAt`, `statusCode`, `errorType`), API denormalized `currentStatus` (`critical`), and `incidents` collection with embedded `events` array.
  - **Reconciled Workflows.md:** Documented Scenario A (Warm API with established baseline) vs Scenario B (Cold-Start API failing from check 1). For cold-start APIs, failure rate anomaly fires at Cycle 5 (when baseline reaches 5 checks), and Incident is created at Cycle 6 (when 2-cycle consecutive guard is satisfied).

## In Progress
- Step 5 complete and verified against real Docker database. Awaiting Step 6 execution.

## Next Up
1. Step 6: Real-Time Layer (`development-plan.md` Step 6 & `requirements.md` §6):
   - Socket.IO server setup with JWT authentication middleware (`sockets/incidentSocket.ts`).
   - Room join on `org:<id>` for tenant isolation (`architecture.md` §6).
   - Emit `api:status_changed`, `incident:created`, `incident:updated` events.
   - Cross-process event publishing via Redis Pub/Sub (so worker process events reach Socket.IO clients).
   - Frontend Socket.IO client integration in `AuthContext` / Dashboard.
   - Test checkpoint: multi-tab live update without refresh.

## Decisions Made During Build (append here as they happen)
- **Scaffold build setup:** Configured `tsx` for TypeScript execution in backend dev mode; configured Tailwind tokens (`ink-950`, `ink-900`, `ink-700`, `mist-400`, `mist-100`, `signal-blue`, `status-ok`, `status-warn`, `status-critical`, `status-resolved`) and Google Fonts (`Inter`, `JetBrains Mono`).
- **Auth Architecture:** In-memory access token storage with httpOnly refresh token cookie. Dual support for Mongo replica set transactions and standalone Mongo fallback in development. Generic `requireRole` RBAC middleware created for immediate reusability in Step 3.
- **Docker Compose Mongo ReplicaSet:** Configured `mongo:6.0` in `docker-compose.yml` with `--replSet rs0` and automated healthcheck `mongosh` evaluation to support Mongoose transactions seamlessly.
- **API Registry Design:** Enforced strict interval choices (60s, 300s, 900s) and method restriction. Table-first dense UI layout with semantic status indicators.
- **Worker & Scheduling Architecture:** BullMQ queue with exponential backoff retries. Database-enforced idempotency on `Check` collection (`{ apiId: 1, scheduledTime: 1 }` unique index). Automatic boot reconciliation syncs repeatable BullMQ jobs with enabled APIs in MongoDB.
- **Anomaly & Incident Architecture:** Pure functional detection logic (`detectAnomaly`) with human-readable reason strings and multi-tier severity. Enforced fixed 5-check window denominator and 5-check baseline guard. Redis rolling window (20 items) + consecutive cycle guard (2 cycles) to prevent alert fatigue. Server-side resolve guard enforcing passing status prior to closing incidents. Real database verification performed against Docker Mongo & Redis.

## Known Open Questions
- Exact deadline for the MERN referral was never confirmed — `phase.md` currently assumes ~10-12 days. Revisit if that changes.

## Things Cyrus Must Be Able to Explain (rolling list, pulled from other docs)
From `architecture.md` §8:
- Why BullMQ/Redis over `setInterval`.
- Why anomaly detection is stats-based, not ML.
- Why Socket.IO rooms are per-org.
- The full request→incident→socket flow.

From `database.md` §11:
- Why `checks` has a compound unique index on `apiId + scheduledTime`.
- Embed vs. reference: `IncidentEvent` vs. `checks`.
- Why `apis.currentStatus` is denormalized.

From `api.md` explainability checklist:
- Why incidents have no `POST` endpoint.
- Why sockets are read-only.
- Why `organizationId` is never client-supplied.
