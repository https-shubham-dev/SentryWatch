# SentryWatch — Development Plan

This translates `phase.md` (when) + `architecture.md` (how) + `requirements.md` (what) into an actual build order an AI agent (or you) can follow step by step without re-deriving decisions mid-flight.

## Build Order (maps to phase.md, more granular)

### Step 1: Scaffold
1. `git init`, root folders `backend/`, `frontend/`, shared `docs/` (this planning set).
2. `backend`: `npm init`, TypeScript, Express, ESLint/Prettier configs, `tsconfig.json` with `strict: true` (per `rules.md` §3).
3. `frontend`: Vite + React + TS template, Tailwind installed and configured with the tokens from `gen-design.md`.
4. `docker-compose.yml`: services for `app`, `mongo`, `redis`. `.env.example` committed, `.env` gitignored.
5. Verify: `docker compose up`, hit `/api/health`, see `200 { status: 'ok' }`.

### Step 2: Auth + Org (implements requirements.md §1)
1. Mongoose models: `Organization`, `User` (database.md §2-3).
2. `auth` module: routes → controller → service, following the layering in `architecture.md` §5.
3. JWT middleware + RBAC middleware (`rules.md` §2, §7 for error handling pattern).
4. Frontend: signup/login forms, token storage (access token in memory/context, refresh via httpOnly cookie automatically), protected route wrapper.
5. Test checkpoint: signup → login → `/auth/me` returns correct user+org → logout clears session.

### Step 3: API Registry (requirements.md §2)
1. `Api` model (database.md §4).
2. CRUD module following the same routes→controller→service→model shape.
3. Frontend: API list table (per `gen-design.md` §4 layout), add/edit form.
4. Test checkpoint: create an API, see it in the list with `currentStatus: 'unknown'`.

### Step 4: Worker + Scheduling (requirements.md §3)
1. Redis + BullMQ connection setup in `config/`.
2. `workers/scheduler.ts`: on boot, registers a repeatable job per enabled API; reconciliation logic to catch any enabled API missing a job (workflows.md Workflow 1 edge case).
3. `workers/checkWorker.ts`: processes a job — HTTP request, timeout handling, writes `Check` document with the idempotency-safe compound key (database.md §5).
4. Test checkpoint: register an API pointing at a real public endpoint (e.g., `https://httpstat.us/200`), confirm `checks` collection fills in on schedule, confirm a duplicate scheduled-time job doesn't create duplicate records (kill and restart the worker to test crash-recovery idempotency).

### Step 5: Anomaly Detection + Incidents (requirements.md §4-5)
1. `modules/anomaly/detection.ts` — pure function, unit tests first (TDD makes sense here specifically, per `rules.md` §8 100%-coverage requirement).
2. Redis rolling-window read/write helpers.
3. `Incident` model + lifecycle transition validation (database.md §6-7).
4. Wire detection into `checkWorker.ts`: after writing a Check, run detection, apply the "2 consecutive cycles" guard, create/update incident as needed.
5. Test checkpoint: point an API at `https://httpstat.us/500`, watch it progress through Workflow 3 exactly as documented — warn status, then incident creation after the guard is satisfied.

### Step 6: Real-Time Layer (requirements.md §6)
1. Socket.IO server setup, JWT-authenticated connection, room join on `org:<id>` (architecture.md §6).
2. Emit `api:status_changed`, `incident:created`, `incident:updated` from the relevant service methods (not scattered ad hoc — one clear emission point per event type).
3. Frontend: socket client connects on auth, dashboard subscribes and updates state directly on events.
4. Test checkpoint: two browser tabs (or two team members), trigger a failure in one, watch the other update live with no refresh.

### Step 7: Incident Detail + Manual Transitions
1. Incident detail page: timeline (embedded events), reason string display, status transition buttons.
2. `PATCH /incidents/:id/status` with server-side transition + resolve-guard validation (requirements.md §5).
3. Test checkpoint: Workflow 4 end to end — investigate, attempt premature resolve (should reject), fix, resolve successfully.

### Step 8: Polish + Deploy (phase.md Phase 5)
1. Seed script (a few demo APIs, one intentionally flaky pointed at `httpstat.us` with a random-failure endpoint).
2. Deploy: Mongo Atlas, Redis Cloud/Upstash, backend+worker on Render, frontend on Vercel.
3. GitHub Actions: lint + `jest` on push.
4. README: architecture diagram (from `architecture.md` §2), setup steps, GIF of live dashboard.

### Step 9+: Phase 2 stretch (only if time remains, priority order from phase.md §Phase 6)
Follow `requirements.md` §7-10 and `workflows.md` Workflow 5-6 directly — each is scoped as a mostly self-contained addition to the Step 1-8 foundation, so they can be picked up independently without re-touching core modules.

## Working Agreement (how to actually use AI for this)
- Give the AI one module/step at a time, pointing it at the specific `.md` sections that constrain it — not the whole doc set at once, which invites scope creep.
- After each step, **you** narrate the flow back before moving on (this is the actual learning mechanism — generating code isn't understanding it).
- Keep `memory.md` updated after every session (see that file) so context isn't lost between AI sessions.
