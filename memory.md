# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-09-27
**Phase:** Step 1 (Scaffold) complete. Ready for Step 2 (Auth + Org).

## Completed
- [x] Full planning doc set (`prd.md` through `development-plan.md`) placed in `docs/`.
- [x] Step 1: Scaffold repository structure:
  - `git init` completed, `.gitignore` created.
  - `backend/`: Express + TypeScript (`strict: true`), ESLint, Prettier, Jest, `/api/health` endpoint created & verified returning `200 { status: 'ok' }`.
  - `frontend/`: Vite + React + TypeScript + Tailwind CSS configured with design tokens from `gen-design.md`.
  - `docker-compose.yml` for `app`, `mongo`, and `redis`. `.env.example` and `.env` configured.

## In Progress
- Step 1 complete. Awaiting user verification before initiating Step 2.

## Next Up
1. Step 2: Auth + Org (`development-plan.md` Step 2 & `requirements.md` §1):
   - Mongoose models: `Organization`, `User`.
   - `auth` module (routes → controller → service).
   - JWT middleware + RBAC middleware.
   - Frontend signup/login forms & token handling.

## Decisions Made During Build (append here as they happen)
- **Scaffold build setup:** Configured `tsx` for TypeScript execution in backend dev mode; configured Tailwind tokens (`ink-950`, `ink-900`, `ink-700`, `mist-400`, `mist-100`, `signal-blue`, `status-ok`, `status-warn`, `status-critical`, `status-resolved`) and Google Fonts (`Inter`, `JetBrains Mono`).

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
