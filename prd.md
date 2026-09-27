# SentryWatch — Product Requirements Document

## 1. What SentryWatch Is

SentryWatch is an **API reliability and incident intelligence platform**. Companies register their APIs; SentryWatch continuously health-checks them, detects failures/regressions, creates incidents automatically, tracks incident lifecycle, and gives developers a real-time technical view of what broke and when.

Think: a lightweight combination of **Postman (API testing)** + **Datadog/UptimeRobot (monitoring)** + **PagerDuty (incident management)** — built small, but built right.

## 2. Why This Exists (Problem Statement)

When an API breaks in a real company, three things usually happen badly:
1. Nobody notices until a user complains (no monitoring).
2. When someone does notice, there's no structured way to track "is this being worked on / is it fixed" (no incident lifecycle).
3. Engineers waste time manually correlating "wait, did the Payment API go down *before* Orders started failing?" (no correlation).

SentryWatch solves a scaled-down version of all three, which is why it's a genuinely defensible engineering project — not decorative CRUD.

## 3. Users / Roles

| Role | Description |
|---|---|
| **Admin** | Owns an organization (tenant). Registers APIs, manages team members, views billing/usage (out of scope for MVP — see Phase 2). |
| **Developer/Member** | Views dashboards, investigates incidents, updates incident status, can register/edit APIs depending on permission. |
| **(System) Worker** | Not a human role — the background process that executes scheduled health checks. Documented here because it acts as an actor in workflows. |

RBAC is simple for MVP: `admin` and `member`. No custom permission granularity in Phase 1.

## 4. Core Modules

### 4.1 API Registry (Phase 1)
- Register an API endpoint: method, URL, expected status code, headers/auth if needed, check interval.
- Enable/disable monitoring per endpoint.

### 4.2 API Monitoring (Phase 1)
- Background worker executes scheduled health checks per registered endpoint (via BullMQ + Redis).
- Records: status code, response time, timestamp, pass/fail.
- Computes rolling metrics: failure rate %, average latency over a moving window.

### 4.3 Anomaly Detection (Phase 1 — statistical only)
- Compares latest response against rolling average/std-dev of recent checks.
- Flags anomaly if latency or failure rate crosses a defined threshold (e.g., >3x rolling average, or failure rate jumps >X% in Y minutes).
- No ML in Phase 1 — pure statistics. Explainable by design.

### 4.4 Incident Management (Phase 1)
- Auto-creates an incident when an anomaly is confirmed (not on first failure — avoid alert fatigue; require N consecutive failures or a sustained threshold breach).
- Incident lifecycle: **Detected → Investigating → Mitigated → Resolved**
- Manual status transitions by a Developer/Member.
- Incident detail: affected API, severity (derived from failure rate/latency delta), timeline of status changes, associated raw check data.

### 4.5 Real-Time Dashboard (Phase 1)
- Live view of all registered APIs and their current health.
- Live incident feed — new incidents and status changes push instantly via Socket.IO (no refresh).

### 4.6 API Dependency Graph (Phase 2)
- Admin defines which APIs depend on which (e.g., Order API → Payment API).
- Visualized as an interactive graph (React Flow).

### 4.7 Incident Correlation (Phase 2)
- Rule-based (not ML): if two+ incidents occur within the same time window AND have a declared dependency relationship, SentryWatch surfaces them as "possibly related."

### 4.8 API Contract Testing (Phase 2)
- Upload an OpenAPI spec for an endpoint.
- Worker validates actual response status/shape against the spec, flags contract violations separately from uptime failures.

### 4.9 AI Incident Summary (Phase 2)
- Given structured incident + correlation data (not raw logs), an LLM call generates a plain-English "likely cause" summary.
- This is intentionally the *last* feature built — it's a thin layer on top of already-structured data, not the core engineering.

## 5. Out of Scope (for now)
- Billing/subscriptions
- Multi-region monitoring (single worker region is fine)
- Mobile app
- Custom alerting channels (email/Slack) — could be a Phase 3 idea, not committed

## 6. Success Criteria for MVP (Phase 1)
- Can register an API and see it being checked on schedule.
- A deliberately broken/slow endpoint triggers an incident automatically.
- Dashboard updates in real time without refresh.
- Every incident has a clear, correct lifecycle history.
- Cyrus can explain, unaided, how the worker → queue → detection → incident → socket flow works end to end.

## 7. Open Questions
- Timeline: referral urgency vs. full Phase 1+2 scope — needs a firm deadline to lock the phase plan (see `phase.md`).
