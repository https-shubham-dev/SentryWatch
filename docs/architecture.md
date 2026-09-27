# SentryWatch — Architecture

## 1. Style: Modular Monolith

Not microservices. One Node/Express codebase, split into clear internal modules (like Spring Boot layers you already know). Microservices would add deployment complexity with zero benefit at this scale — and a bloated "I used microservices for a todo app" is a red flag in interviews, not a strength. A well-structured monolith that *could* be split later shows maturity instead.

## 2. High-Level Component Diagram

```
                        React Dashboard (Vite)
                               │
                ┌──────────────┴──────────────┐
                │                              │
           REST API (Express)             Socket.IO (WS)
                │                              │
                └──────────────┬───────────────┘
                               ↓
                        Node / Express App
                               │
        ┌──────────────────────┼──────────────────────┐
        ↓                      ↓                      ↓
    MongoDB               Redis (BullMQ)          Auth (JWT)
   (persistent            (job queue +
    data: users,           rolling metrics
    apis, incidents,       cache)
    checks)                     │
                                 ↓
                           Worker Process
                                 │
                                 ↓
                        Executes scheduled
                        HTTP health checks
                        against registered
                        APIs → writes results
                        back → triggers anomaly
                        detection → may create
                        Incident → emits Socket.IO
                        event
```

## 3. Request Flow (two kinds)

**A. Normal API request (e.g., "show me my APIs")**
```
Client → Express Route → Controller → Service → MongoDB (Mongoose) → Response
```
This mirrors your Spring Boot layering: Route ≈ Controller mapping, Controller ≈ Controller, Service ≈ Service, Mongoose Model ≈ Repository/Entity.

**B. Background health-check cycle (the core engineering flow)**
```
Scheduler (BullMQ repeatable job)
   → enqueues a "check" job per registered API on its interval
   → Worker process picks job from Redis queue
   → Worker makes HTTP request to target API
   → Worker writes result to MongoDB (Check collection)
   → Worker updates rolling stats in Redis (fast read/write, avoid hammering Mongo)
   → Anomaly Detection Service evaluates: does this breach threshold?
        → No: done
        → Yes: check "N consecutive failures" rule
             → Not yet: log as warning
             → Yes: create Incident in MongoDB
                  → emit Socket.IO event to that org's "room"
                  → connected dashboards update instantly, no refresh
```

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast dev loop, type safety |
| Styling | Tailwind CSS | Speed, consistency |
| Charts | Recharts | Latency/failure-rate graphs |
| Graph (Phase 2) | React Flow | Dependency visualization |
| Backend | Node + Express + TypeScript | Type-safe backend, matches modern MERN expectations |
| Realtime | Socket.IO | Simplest reliable WS abstraction, room-based broadcasting |
| Auth | JWT (access + refresh token pair) | Stateless auth, standard practice |
| Primary DB | MongoDB (Mongoose) | Flexible schema for check results, the "M" in MERN |
| Queue/Cache | Redis + BullMQ | Scheduled/background jobs, rolling metrics cache |
| Testing | Jest | Unit tests for anomaly detection logic especially — this is the part you must be able to prove works |
| Infra | Docker + Docker Compose | Local parity: app + Mongo + Redis all spin up together |
| CI | GitHub Actions | Lint + test on push — shows real workflow discipline |
| AI (Phase 2) | Gemini/OpenAI API | Incident summary generation only — not core logic |

## 5. Package Structure (Backend)

```
backend/
├── src/
│   ├── config/          # env, db connection, redis connection
│   ├── modules/
│   │   ├── auth/        # controller, service, routes
│   │   ├── organizations/
│   │   ├── apis/        # API registry CRUD
│   │   ├── checks/      # check results, stats
│   │   ├── incidents/   # incident lifecycle logic
│   │   └── anomaly/     # detection service (pure functions, heavily tested)
│   ├── workers/
│   │   ├── scheduler.ts # registers repeatable BullMQ jobs
│   │   └── checkWorker.ts # processes each check job
│   ├── sockets/
│   │   └── incidentSocket.ts # room join/leave, event emitters
│   ├── middleware/
│   │   ├── auth.ts      # JWT verification
│   │   ├── rbac.ts       # admin/member guard
│   │   └── errorHandler.ts
│   ├── models/           # Mongoose schemas
│   └── app.ts
├── tests/
└── Dockerfile
```

Each `modules/*` folder follows: `*.routes.ts → *.controller.ts → *.service.ts → model`. Same shape as your Spring Boot Controller/Service/Repository — this is deliberate, so you're translating a pattern you already understand, not learning a new one from scratch.

## 6. Multi-Tenancy Model

Every document (API, Check, Incident) has an `organizationId`. All queries are scoped by the authenticated user's org. Socket.IO rooms are per-org (`org:<id>`), so real-time events never leak across tenants. This is the "multi-tenant SaaS" pattern interviewers actually mean when they ask about it — not a separate database per client (overkill here).

## 7. Security Notes
- Passwords hashed with bcrypt.
- JWT access token short-lived (e.g., 15 min), refresh token longer-lived, stored httpOnly cookie.
- Rate limiting on auth routes (express-rate-limit) — prevents brute force, cheap to add, good talking point.
- All org-scoped queries filtered server-side by `organizationId` from the JWT — never trust a client-supplied org ID.

## 8. What You Must Be Able to Explain (minimum bar)
1. Why BullMQ/Redis instead of a simple `setInterval` loop (answer: persistence, retries, horizontal scalability, avoids duplicate jobs on restart).
2. Why anomaly detection is rule/stats-based, not ML (answer: explainability, no training data available, deterministic and testable).
3. Why Socket.IO rooms are scoped per-org (answer: tenant isolation).
4. The exact path of a request from "API goes down" to "dashboard updates" (Section 3B above — memorize this flow).
