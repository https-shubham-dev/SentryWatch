# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-09-27
**Phase:** Step 3 (API Registry) complete. Ready for Step 4 (Worker + Scheduling).

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
  - API Registry module: `ApisService` (CRUD with mandatory `organizationId` scoping, strict validation for `checkIntervalSeconds` [60/300/900], HTTP methods [GET/POST/PUT/DELETE], URL, expected status code), `ApisController`, `apis.routes.ts`.
  - RBAC protection: Admin role required for `POST`, `PATCH`, `DELETE`; `member` and `admin` roles can view endpoints via `GET`. Member mutation attempts return `403 Forbidden`.
  - Delete safety: `DELETE /apis/:id` removes `Api` document without cascade-deleting historical checks or incidents.
  - Frontend: `DashboardPage` updated with dense Grafana/Linear style API Registry data table, status summary strip (Healthy / Degraded / Failing / Pending), and `ApiModal` form for endpoint registration & editing.
  - Test suites & builds verified: 0 TypeScript errors across backend and frontend, unit test suites passing.

## In Progress
- Step 3 complete. Awaiting user verification before initiating Step 4.

## Next Up
1. Step 4: Worker + Scheduling (`development-plan.md` Step 4 & `requirements.md` §3):
   - Redis + BullMQ connection setup in `config/`.
   - `workers/scheduler.ts`: registers repeatable job per enabled API on boot with reconciliation logic.
   - `workers/checkWorker.ts`: processes job (HTTP request, timeout handling, writes `Check` document with idempotency compound key `apiId + scheduledTime`).
   - Test checkpoint: register an API pointing at real endpoint, verify `checks` collection populates on schedule, verify crash recovery idempotency.

## Decisions Made During Build (append here as they happen)
- **Scaffold build setup:** Configured `tsx` for TypeScript execution in backend dev mode; configured Tailwind tokens (`ink-950`, `ink-900`, `ink-700`, `mist-400`, `mist-100`, `signal-blue`, `status-ok`, `status-warn`, `status-critical`, `status-resolved`) and Google Fonts (`Inter`, `JetBrains Mono`).
- **Auth Architecture:** In-memory access token storage with httpOnly refresh token cookie. Dual support for Mongo replica set transactions and standalone Mongo fallback in development. Generic `requireRole` RBAC middleware created for immediate reusability in Step 3.
- **Docker Compose Mongo ReplicaSet:** Configured `mongo:6.0` in `docker-compose.yml` with `--replSet rs0` and automated healthcheck `mongosh` evaluation to support Mongoose transactions seamlessly.
- **API Registry Design:** Enforced strict interval choices (60s, 300s, 900s) and method restriction. Table-first dense UI layout with semantic status indicators.

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
