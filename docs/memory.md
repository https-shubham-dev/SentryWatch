# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-09-27
**Phase:** Step 4 (Worker + Scheduling) complete. Ready for Step 5 (Anomaly Detection + Incidents).

## Completed
- [x] Full planning doc set (`prd.md` through `development-plan.md`) placed in `docs/`.
- [x] Step 1: Scaffold repository structure (backend, frontend, docker-compose).
- [x] Step 2: Auth + Org (`requirements.md` §1, `database.md` §2-3, `architecture.md` §5 & §7, `rules.md` §2 & §7):
  - Mongoose models: `Organization` & `User`.
  - Auth module: `AuthService`, `AuthController`, `auth.routes.ts`, `authenticate`, `requireRole`.
  - Frontend: `AuthContext`, `apiClient` with silent auto-refresh, `ProtectedRoute`, `LoginPage`, `SignupPage`.
- [x] Pre-Step 3 Check: Updated `docker-compose.yml` to configure single-node replica set `rs0` for MongoDB with automated healthcheck initiation so Mongoose transactions function out of the box in Docker environment.
- [x] Step 3: API Registry (`requirements.md` §2, `database.md` §4, `api.md` APIs table, `gen-design.md` §4):
  - Mongoose model: `Api` with `organizationId` index and `{ organizationId: 1, enabled: 1 }` compound index.
  - API Registry module: `ApisService` (CRUD with `organizationId` scoping), `ApisController`, `apis.routes.ts` with RBAC guards.
  - Frontend: `DashboardPage` updated with dense Grafana/Linear style API table, overview summary strip, and `ApiModal` form.
- [x] Step 4: Worker + Scheduling (`requirements.md` §3, `database.md` §5, `architecture.md` §3B, `rules.md` §5, `workflows.md` Workflows 1 & 2):
  - Redis + BullMQ configuration in `src/config/redis.ts`.
  - Mongoose model `Check` ([`src/models/Check.ts`](file:///d:/SentryWatch/backend/src/models/Check.ts)) with compound unique index `{ apiId: 1, scheduledTime: 1 }` for database-enforced idempotency.
  - Worker Scheduler ([`src/workers/scheduler.ts`](file:///d:/SentryWatch/backend/src/workers/scheduler.ts)): BullMQ repeatable queue setup, `scheduleApiCheck`, `removeApiCheck`, and `reconcileScheduledJobs` on boot (resolves Workflow 1 edge case).
  - Wired scheduler job registration into `ApisService` (create -> register job, update -> update/remove job, delete -> remove job).
  - Worker process ([`src/workers/checkWorker.ts`](file:///d:/SentryWatch/backend/src/workers/checkWorker.ts)): BullMQ worker processing HTTP requests (10s timeout, capturing latency & status code, handling timeout/network errors), writing idempotency-safe `Check` records, and updating `apis.currentStatus` (`ok` / `critical`).
  - Test suites & builds verified: 0 TypeScript errors across backend and frontend, 4 test suites passing (14 unit/integration tests).

## In Progress
- Step 4 complete. Awaiting user verification before initiating Step 5.

## Next Up
1. Step 5: Anomaly Detection + Incidents (`development-plan.md` Step 5, `requirements.md` §4-5, `rules.md` §6 & §8):
   - `modules/anomaly/detection.ts` — pure function `(recentChecks) => { isAnomaly, reason }` with 100% unit test branch coverage.
   - Redis rolling-window read/write helpers (`rolling:<apiId>`).
   - `Incident` Mongoose model (`database.md` §6-7) + embedded `IncidentEvent`.
   - Wire detection into `checkWorker.ts`: update rolling stats, evaluate anomaly, apply "2 consecutive cycles" guard, create/update incident.

## Decisions Made During Build (append here as they happen)
- **Scaffold build setup:** Configured `tsx` for TypeScript execution in backend dev mode; configured Tailwind tokens (`ink-950`, `ink-900`, `ink-700`, `mist-400`, `mist-100`, `signal-blue`, `status-ok`, `status-warn`, `status-critical`, `status-resolved`) and Google Fonts (`Inter`, `JetBrains Mono`).
- **Auth Architecture:** In-memory access token storage with httpOnly refresh token cookie. Dual support for Mongo replica set transactions and standalone Mongo fallback in development. Generic `requireRole` RBAC middleware created for immediate reusability in Step 3.
- **Docker Compose Mongo ReplicaSet:** Configured `mongo:6.0` in `docker-compose.yml` with `--replSet rs0` and automated healthcheck `mongosh` evaluation to support Mongoose transactions seamlessly.
- **API Registry Design:** Enforced strict interval choices (60s, 300s, 900s) and method restriction. Table-first dense UI layout with semantic status indicators.
- **Worker & Scheduling Architecture:** BullMQ queue with exponential backoff retries. Database-enforced idempotency on `Check` collection (`{ apiId: 1, scheduledTime: 1 }` unique index). Automatic boot reconciliation syncs repeatable BullMQ jobs with enabled APIs in MongoDB.

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
