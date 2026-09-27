# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-09-27
**Phase:** Step 2 (Auth + Org) complete. Ready for Step 3 (API Registry).

## Completed
- [x] Full planning doc set (`prd.md` through `development-plan.md`) placed in `docs/`.
- [x] Step 1: Scaffold repository structure (backend, frontend, docker-compose).
- [x] Step 2: Auth + Org (`requirements.md` §1, `database.md` §2-3, `architecture.md` §5 & §7, `rules.md` §2 & §7):
  - Mongoose models: `Organization` & `User` with indexed fields (`email` unique, `organizationId`).
  - Auth module: `AuthService` (signup with atomic Org + User creation, login with bcrypt validation, refresh token, getMe profile restoration), `AuthController`, `auth.routes.ts`.
  - Auth middleware (`authenticate`) + generic RBAC middleware (`requireRole('admin')`).
  - JWT Access Token (15 min) + Refresh Token (7 days, httpOnly cookie).
  - Frontend: `AuthContext` with in-memory access token storage, `apiClient` Axios instance with auto-refresh interceptor, `ProtectedRoute` wrapper, `LoginPage`, `SignupPage`, and `DashboardPage` styled per `gen-design.md`.
  - Test suites & builds verified: 0 TypeScript compilation errors in backend/frontend, unit test suite passing.

## In Progress
- Step 2 complete. Awaiting user verification before initiating Step 3.

## Next Up
1. Step 3: API Registry (`development-plan.md` Step 3 & `requirements.md` §2):
   - Mongoose model: `Api` (`database.md` §4).
   - `apis` module (CRUD following routes → controller → service → model shape).
   - RBAC guard: `admin` only for create/update/delete.
   - Frontend: API list table (dense Grafana/Linear layout per `gen-design.md` §4), add/edit API modal forms.
   - Test checkpoint: create an API, see it in the list with `currentStatus: 'unknown'`.

## Decisions Made During Build (append here as they happen)
- **Scaffold build setup:** Configured `tsx` for TypeScript execution in backend dev mode; configured Tailwind tokens (`ink-950`, `ink-900`, `ink-700`, `mist-400`, `mist-100`, `signal-blue`, `status-ok`, `status-warn`, `status-critical`, `status-resolved`) and Google Fonts (`Inter`, `JetBrains Mono`).
- **Auth Architecture:** In-memory access token storage with httpOnly refresh token cookie. Dual support for Mongo replica set transactions and standalone Mongo fallback in development. Generic `requireRole` RBAC middleware created for immediate reusability in Step 3.

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
