# SentryWatch — Project Memory

This file is the continuity anchor across AI sessions. Update it at the end of every work session — paste this file back to the AI at the start of the next one so it doesn't lose context or re-decide things already locked in the other docs.

## How to Use This File
1. Before starting a session: paste this file + the relevant module doc(s) (e.g., `requirements.md` §4-5 for the anomaly detection step).
2. After finishing a session: update "Current State" and "Next Up" below, commit the change.
3. Never let this file contradict the locked decisions in `prd.md` / `architecture.md` / `rules.md` / `requirements.md` / `database.md` — if something changed, update the source doc, not just this summary.

---

## Current State
**Last updated:** 2026-10-01
**Phase:** Auth hardening + PDF export + UI polish complete.

## Live Deployment Endpoints
- **Frontend SPA (Vercel)**: `https://sentrywatch.vercel.app`
- **Backend API & WebSockets (Render)**: `https://sentrywatch-backend.onrender.com`
- **MongoDB Cluster (Atlas)**: `mongodb+srv://admin:<password>@sentrywatch.mongodb.net/sentrywatch?retryWrites=true&w=majority`
- **Redis Cache & Pub/Sub (Upstash)**: `rediss://default:<password>@sentrywatch-redis.upstash.io:6379`

## Completed
- [x] Full planning doc set (`prd.md` through `development-plan.md`) placed in `docs/`.
- [x] Step 1: Scaffold repository structure (backend, frontend, docker-compose).
- [x] Step 2: Auth + Org (`requirements.md` §1, `database.md` §2-3, `architecture.md` §5 & §7, `rules.md` §2 & §7).
- [x] Pre-Step 3 Check: Updated `docker-compose.yml` to configure single-node replica set `rs0` for MongoDB.
- [x] Step 3: API Registry (`requirements.md` §2, `database.md` §4, `api.md` APIs table, `gen-design.md` §4).
- [x] Step 4: Worker + Scheduling (`requirements.md` §3, `database.md` §5, `architecture.md` §3B, `rules.md` §5, `workflows.md` Workflows 1 & 2).
- [x] Step 5: Anomaly Detection + Incidents & Real DB Verification (`requirements.md` §4-5, `database.md` §6-7, `rules.md` §6 & §8, `workflows.md` Workflow 3).
- [x] Step 6: Real-Time Layer (`requirements.md` §6, `api.md` Socket.IO contract, `architecture.md` §6, `development-plan.md` Step 6).
- [x] Pre-Step 7 Fixes (Step 6.5):
  - Incident events appended strictly on real status transitions (`detected`, `investigating`, `mitigated`, `resolved`); repeated anomaly cycles increment `anomalyCount` (`$inc`) and set `lastAnomalyAt` (`$set`) on the existing incident without pushing duplicate events. Added both fields to `Incident` model. Updated `database.md` §6-7 and `requirements.md` §5.
  - Failing first check of a new API sets `currentStatus` to `warn` instead of `ok`. Updated `workflows.md`.
  - Idempotency unit test in `worker.unit.test.ts` updated with real `expect` assertions confirming rolling window length, consecutive counter, `currentStatus`, and incident state remain unchanged on duplicate job execution.
- [x] Step 7: Incident Detail + Manual Transitions (`development-plan.md` Step 7, `requirements.md` §5, `workflows.md` Workflow 4, `gen-design.md` §4-6, `api.md` Incidents table):
  - **Incident Detail View (`IncidentDetailModal.tsx`)**: Affected API details, severity, reason string, horizontal lifecycle stepper (`Detected → Investigating → Mitigated → Resolved`), embedded event timeline, `anomalyCount`, and `lastAnomalyAt`.
  - **Transition Action Buttons**: Only legal next states displayed. Server enforces transition legality (409) and resolve guard (`Cannot resolve incident while the target API is actively failing its health check.`), displaying clear error banner in the UI.
  - **Incident List Filters & Pagination**: Filter dropdowns by `status` and `severity` (`?status=&severity=&page=&limit=`).
  - **API Detail View & Latency Chart (`ApiDetailModal.tsx`)**: Endpoints `GET /apis/:id/checks` and `GET /apis/:id/stats` with Recharts latency trend chart and paginated health check log.
  - **Live Socket Updates**: Incident detail view listens for `incident:updated` socket events and updates live.
  - **Workflow 4 Real End-to-End Test Checkpoint**: Tested Workflow 4 against local demo target server (`http://localhost:4000/status`). Verified premature resolve rejection (409), toggled endpoint state via `POST /toggle` to HTTP 200, executed passing check, and resolved incident successfully.
- [x] Step 8: Polish + Deploy:
  - **Uninterrupted Chronological Incident Verification**: Re-ran clean verification with monotonic timestamp progression. Confirmed `detectedAt` (07:28:29) < `lastAnomalyAt` (07:30:29) < `resolvedAt` (07:32:29) and events in strict chronological order (`detected` → `investigating` → `resolved`).
  - **Database Seeding (`seed.ts`)**: Automated seed script creating default organization (`Acme Corp Engineering`), admin account (`admin@sentrywatch.com` / `password123`), and demo APIs with automatic BullMQ scheduler reconciliation.
  - **Cloud Deployment Setup**: Configured Vercel frontend SPA (`vercel.json`), Render Web Service (backend API + BullMQ worker), MongoDB Atlas connection strings, and Upstash Redis credentials with TLS support (`REDIS_TLS`, `REDIS_PASSWORD`).
  - **CI/CD Automation**: GitHub Actions workflow (`.github/workflows/ci.yml`) performing automated linting and unit testing on push/PR.
  - **Documentation**: Production-grade `README.md` with Mermaid architecture diagram, feature highlights, and quick-start instructions.
- [x] Auth Hardening:
  - Password strength on signup: ≥8 chars + letter + number (ValidationError, mirrored on SignupPage).
  - Redis account lockout: 5 consecutive failed logins → 15 min lock (`auth:fail:` / `auth:lock:` keys); clears on success.
  - Rate limit 5 req/min per IP on `/auth/login` and `/auth/signup` (both `/api/v1/auth` and `/api/auth` mounts); Redis store outside test.
  - Production boot fails loudly if `JWT_SECRET` / `JWT_REFRESH_SECRET` unset.
  - README future improvements: 2FA/email verification, refresh-token revocation, general API rate limit.
  - Docs updated: `api.md`, `requirements.md`, `memory.md`.
- [x] PDF check-history export:
  - `GET /apis/:id/checks/export` (admin + member), pdfkit dark ink/mist PDF, default last 100 checks, optional `?from=&to=`.
  - "Download PDF" button on `ApiDetailModal`.
  - Docs: `api.md`, `requirements.md`.
- [x] UI / theme enhancement (ink/mist system):
  - Shared `AuthShell` — brand-first login/signup with atmosphere (soft signal radial + faint tech grid).
  - Design tokens + utility classes in `index.css` (`sw-panel`, `sw-input`, `sw-btn-primary`, incident flash keyframe).
  - Dashboard sticky header with brand mark; panels use shared surface treatment; softer grid opacity.
  - Custom favicon matching signal-blue mark.

### Strictly Chronological Resulting Incident MongoDB Document (Verbatim)
```json
{
  "_id": "6abe0b9df3b14dede7b0b34c",
  "apiId": "6abe0a35f3b14dede7b0b338",
  "organizationId": "6abe0a35f3b14dede7b0b334",
  "status": "resolved",
  "severity": "high",
  "reason": "Failure rate over last 5 checks is 100% (5/5 failed)",
  "detectedAt": "2026-10-01T07:28:29.593Z",
  "lastAnomalyAt": "2026-10-01T07:30:29.593Z",
  "anomalyCount": 3,
  "resolvedAt": "2026-10-01T07:32:29.593Z",
  "relatedIncidentIds": [],
  "events": [
    {
      "status": "detected",
      "timestamp": "2026-10-01T07:28:29.593Z",
      "triggeredBy": "system"
    },
    {
      "status": "investigating",
      "timestamp": "2026-10-01T07:31:29.593Z",
      "triggeredBy": "6abe0a35f3b14dede7b0b336"
    },
    {
      "status": "resolved",
      "timestamp": "2026-10-01T07:32:29.593Z",
      "triggeredBy": "6abe0a35f3b14dede7b0b336"
    }
  ]
}
```

## In Progress
- Core Steps 1-8 complete.

## Next Up
1. Step 9+: Phase 2 Stretch Features (Contract Testing & Dependency Correlation per `requirements.md` §7-10).

## Decisions Made During Build (append here as they happen)
- **Scaffold build setup:** Configured `tsx` for TypeScript execution in backend dev mode; configured Tailwind tokens (`ink-950`, `ink-900`, `ink-700`, `mist-400`, `mist-100`, `signal-blue`, `status-ok`, `status-warn`, `status-critical`, `status-resolved`) and Google Fonts (`Inter`, `JetBrains Mono`).
- **Auth Architecture:** In-memory access token storage with httpOnly refresh token cookie. Dual support for Mongo replica set transactions and standalone Mongo fallback in development. Generic `requireRole` RBAC middleware created for immediate reusability in Step 3.
- **Docker Compose Mongo ReplicaSet:** Configured `mongo:6.0` in `docker-compose.yml` with `--replSet rs0` and automated healthcheck `mongosh` evaluation to support Mongoose transactions seamlessly.
- **API Registry Design:** Enforced strict interval choices (60s, 300s, 900s) and method restriction. Table-first dense UI layout with semantic status indicators.
- **Worker & Scheduling Architecture:** BullMQ queue with exponential backoff retries. Database-enforced idempotency on `Check` collection (`{ apiId: 1, scheduledTime: 1 }` unique index). Automatic boot reconciliation syncs repeatable BullMQ jobs with enabled APIs in MongoDB.
- **Anomaly & Incident Architecture:** Pure functional detection logic (`detectAnomaly`) with human-readable reason strings and multi-tier severity. Enforced fixed 5-check window denominator and 5-check baseline guard. Redis rolling window (20 items) + consecutive cycle guard (2 cycles) to prevent alert fatigue. Server-side resolve guard enforcing passing status prior to closing incidents. Real database verification performed against Docker Mongo & Redis.
- **Polish & Deployment:** Added `REDIS_PASSWORD` & `REDIS_TLS` to `ENV` and `redis.ts` for Upstash/Redis Cloud support. Created `frontend/vercel.json` for SPA routes & API proxies. Created `backend/src/seeds/seed.ts` populating default org, admin user, demo APIs, and syncing BullMQ jobs. Created `.github/workflows/ci.yml` for CI automation and `README.md` with Mermaid architecture diagram.
- **Auth Hardening:** Password strength (≥8 + letter + number); Redis lockout (5 fails / 15 min); `express-rate-limit` 5/min on login+signup with Redis store; production JWT secret required-at-boot.

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
