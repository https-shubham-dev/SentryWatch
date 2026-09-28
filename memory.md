# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-09-28
**Phase:** Step 6 (Real-Time Layer) complete. Ready for Step 7 (Incidents Workflow).

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
- [x] Step 6: Real-Time Layer (`requirements.md` §6, `api.md` Socket.IO contract, `architecture.md` §6, `development-plan.md` Step 6):
  - Socket.IO server attached to HTTP server ([`src/sockets/incidentSocket.ts`](file:///d:/SentryWatch/backend/src/sockets/incidentSocket.ts)).
  - Handshake JWT authentication verifying access token and assigning socket to room `org:<organizationId>`. Token-derived org ID only (never client-supplied).
  - Redis Pub/Sub event bus ([`src/sockets/redisPubSub.ts`](file:///d:/SentryWatch/backend/src/sockets/redisPubSub.ts)) channel `sentrywatch:events` for cross-process event broadcasting from BullMQ worker processes to Socket.IO connected clients.
  - Exactly three events emitted (`api:status_changed`, `incident:created`, `incident:updated`), routed strictly to corresponding `org:<organizationId>` room. Zero per-check spam.
  - Frontend integration (`SocketContext.tsx` & `DashboardPage.tsx`): live incident feed with 2s left-border flash animation (`newIncidentFlashId`), status transition action buttons, and automatic REST refetch on socket reconnect to reconcile missed events. Handles token refresh cleanly.
  - Socket.IO test suite ([`tests/socket.test.ts`](file:///d:/SentryWatch/backend/tests/socket.test.ts)) verifying handshake auth rejection, valid token connection, and strict multi-tenant room isolation.
- [x] Worker Idempotency Fix & Real 7-Minute Scheduler Verification:
  - **Worker Idempotency Guard**: Updated `checkWorker.ts` so that if `Check.updateOne` with `{ upsert: true }` returns `upsertedCount === 0` (or catches E11000 duplicate key error), the worker logs the idempotency guard and **returns immediately**. Zero side effects on Redis, API status, or incident state for duplicate job executions.
  - **Demo Target Server**: Created `tools/demo-target/server.js` (`/ok`, `/fail`, `/slow`, `/status`, `/toggle`).
  - **Real 7-Minute Verification**: Ran real BullMQ repeatable job scheduler over 420 seconds (7 full 60s intervals) against local demo target `/status` returning HTTP 500 continuously with zero mocks or direct processor calls. Verified 7 Check documents naturally generated exactly 60 seconds apart (`06:54:00` through `07:00:00`), first anomaly detected at Check 5 (5 prior baseline checks reached), and Incident created at Check 6 (2 consecutive anomaly cycles met). Raw DB & Redis documents extracted verbatim.

## In Progress
- Step 6 complete. Awaiting Step 7 execution.

## Next Up
1. Step 7: Incidents Workflow & UI (`development-plan.md` Step 7 & `requirements.md` §5).

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
