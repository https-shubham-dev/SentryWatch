# SentryWatch — Phase Plan

> **Assumption flagged:** No deadline was given, so this assumes a ~10-12 day build (realistic for AI-assisted development where you still need to understand each piece, not just approve code). If your actual deadline is tighter, tell me and I'll compress Phase 1 further and push everything else to "later/optional." If it's longer, Phase 2 items simply stop being optional.

## Phase 0 — Foundation (Day 1)
- Repo setup: `backend/` + `frontend/` folders, TypeScript config, ESLint/Prettier.
- Docker Compose: Node app + MongoDB + Redis running together locally.
- Base Express app with health-check route (`/api/health`) — sanity check the skeleton works before building anything real.
- Base React app with Tailwind wired up, routing skeleton (login, dashboard placeholder pages).

**Explainability checkpoint:** you should be able to explain what each container in `docker-compose.yml` does and why they're networked together.

## Phase 1 — Auth + Multi-Tenancy (Days 2-3)
- User + Organization models (Mongoose).
- Signup/login with JWT (access + refresh).
- Auth middleware + RBAC middleware (admin/member).
- Every subsequent model gets `organizationId` from day one — retrofitting multi-tenancy later is painful, so this is done first.

**Explainability checkpoint:** walk through the JWT flow — what's in the token, how refresh works, why org ID comes from the token not the request body.

## Phase 2 — API Registry + Health Check Worker (Days 4-5)
- CRUD for registered APIs.
- BullMQ scheduler: repeatable job per API on its configured interval.
- Worker: executes HTTP check, records result to MongoDB `Check` collection.
- Basic dashboard page listing registered APIs with last-check status (not real-time yet — just a refreshable table first, to prove the core loop works).

**Explainability checkpoint:** the full path from "job scheduled" to "check result in DB" — this is the heart of the project.

## Phase 3 — Anomaly Detection + Incident Lifecycle (Days 6-7)
- Rolling stats calculation (Redis cache of recent latency/failure rate per API).
- Anomaly detection service (pure function, unit tested per `rules.md`).
- Incident model + lifecycle state machine (Detected → Investigating → Mitigated → Resolved).
- Auto-create incident when anomaly confirmed (with the "N consecutive failures" guard).

**Explainability checkpoint:** trigger a deliberate failure (point a check at a dead URL) and narrate, out loud, every step until an incident appears.

## Phase 4 — Real-Time Dashboard (Days 8-9)
- Socket.IO server setup, per-org rooms.
- Emit events on: new check result (optional, can be noisy), new incident, incident status change.
- Frontend: connect socket on login, join org room, update dashboard state on events — no polling, no refresh.
- Incident detail page with timeline/history.

**Explainability checkpoint:** explain why rooms are per-org and what would happen (bug-wise) if you forgot that scoping.

## Phase 5 — Polish + Deploy (Day 10)
- Deploy: backend + workers on Render (or Railway), MongoDB Atlas, Redis on Upstash/Redis Cloud, frontend on Vercel.
- GitHub Actions: lint + test on push.
- README with architecture diagram (reuse from `architecture.md`), setup instructions, screenshots/GIF of the real-time dashboard in action (this matters a lot for a resume link — recruiters click and look, they don't clone and run).
- Seed script: a few demo APIs, one intentionally flaky, so anyone viewing the deployed demo sees an incident happen live.

**MVP is done here. This alone is resume-ready and demoable.**

---

## Phase 6 — Stretch Goals (only if time remains, in priority order)
1. **API Dependency Graph** (React Flow) — visually strong, good demo value, moderate effort.
2. **OpenAPI Contract Testing** — strong second resume bullet, self-contained (doesn't touch existing modules much).
3. **Rule-Based Incident Correlation** — needs dependency graph done first (Phase 6.1) since correlation uses declared dependencies.
4. **AI Incident Summary** — last, deliberately. It's a thin LLM call on top of already-structured data — the "wow" feature for a demo, but the least interview-defensible if it's the *only* thing you understand.

## Priority Rule
If the referral deadline forces a cut, cut from the bottom of Phase 6 upward — never cut Phase 0-5. A working, explainable MVP beats a half-built feature-rich mess every time, especially since you have to defend it live.
