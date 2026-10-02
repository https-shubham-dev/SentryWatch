# SentryWatch — Functional Requirements

Module-by-module detail, expanding on `prd.md`. Each locked decision exists to remove ambiguity before coding starts — these are the calls that would otherwise get decided inconsistently mid-build.

## 1. Auth & Organizations

**Requirements:**
- Signup creates a User **and** an Organization (the signing-up user becomes that org's `admin`) in one transaction.
- Signup email must match a basic format check (`local@domain.tld`); invalid emails are rejected with a validation error (not only HTML `type=email` on the client).
- Signup password must be at least 8 characters and include at least one letter and one number; weak passwords are rejected with a clear validation error (not silently accepted).
- Login returns access token (15 min expiry) + refresh token (7 days, httpOnly cookie).
- After 5 consecutive failed login attempts for an email, that account is locked for 15 minutes (Redis-backed); further attempts return `429` with a clear lockout message. Counter clears on successful login.
- `/auth/login` and `/auth/signup` are rate-limited to 5 requests/minute per IP. Authenticated API routes are limited to 100 requests/minute per user.
- `/auth/me` returns current user + org context, used by frontend on app load to restore session.
- Invite flow: admin can invite a member by email (Phase 2 — Phase 1 ships with manual org membership only, since a full invite/email system is out of scope for MVP).

**Locked decisions:**
- One user belongs to exactly one organization (no multi-org membership in MVP — avoids a whole class of context-switching UI/logic).
- Only `admin` role can register/edit/delete APIs. `member` role is read + incident status updates only.
- Account lockout lives in Redis (ephemeral TTL), not on the User document — fits a 15-minute window and works across multiple API instances.
- Full 2FA / email verification is out of scope for MVP (requires an email provider).

## 2. API Registry

**Requirements:**
- Fields: name, method (GET/POST/PUT/DELETE), URL, expected status code, optional headers (for simple auth like API keys), check interval (60s / 5min / 15min — fixed options, not free-form, to keep the scheduler simple), enabled/disabled toggle.
- List view shows current status derived from most recent check (ok/warn/critical/unknown).
- Admin and member can export an API's check history as a server-generated PDF (`GET /apis/:id/checks/export`): default last 100 checks, optional `?from=&to=` date range; includes summary stats (uptime %, avg latency) and a table of checks. Download control lives on the API detail view.
- Delete an API cascades: stops its scheduled job, but **does not delete historical Check/Incident records** (audit trail matters even after an API is removed from monitoring).

**Locked decisions:**
- Minimum check interval is 60 seconds — prevents accidental DDoS of a target API and keeps the worker load predictable for a portfolio-scale deployment.
- Only GET/POST/PUT/DELETE supported (no PATCH/HEAD in MVP) — narrows the request-building logic.

## 3. Health Check Worker

**Requirements:**
- Each enabled API gets a BullMQ repeatable job matching its interval.
- Job execution: send configured HTTP request, capture status code + response time, handle timeout (fixed 10s timeout — a hung request shouldn't block the queue).
- On success: write Check record with `passed: true/false` (passed = actual status matches expected status), latency.
- On network error (DNS failure, connection refused, timeout): write Check record with `passed: false`, `errorType: 'network'`, latency null.

**Locked decisions:**
- Check records are **never deleted automatically** in MVP (no retention/cleanup job) — acceptable at portfolio scale, but worth noting as a known limitation you can mention proactively in an interview ("in production I'd add a TTL index for retention").
- Jobs are idempotent by design: each job run is identified by `apiId + scheduledTime`, so a retry after crash-recovery doesn't create a duplicate Check for the same scheduled slot.

## 4. Anomaly Detection

**Requirements:**
- Maintains a rolling window (last 20 checks, or last 30 minutes, whichever is smaller) per API in Redis for fast access.
- Computes: rolling average latency, rolling failure rate.
- Anomaly triggers (either condition):
  - Latency > 3x rolling average AND rolling average is based on ≥5 prior data points (avoids false positives on a brand-new API with no baseline yet).
  - Failure rate over last 5 checks ≥ 60%.
- Detection function is pure (per `rules.md` §6) and returns a reason string used directly in the incident description.

**Locked decisions:**
- Thresholds (3x latency, 60% failure rate, window sizes) live in `config/thresholds.ts` as named constants — tunable without touching detection logic, and you can honestly say "these are configurable" in an interview rather than admitting they're hardcoded magic numbers.

## 5. Incident Management

**Requirements:**
- Auto-created when anomaly detection fires AND the anomaly persists for **2 consecutive check cycles** (not a single blip) — this guard prevents alert fatigue from one-off network hiccups.
- Lifecycle: `Detected → Investigating → Mitigated → Resolved`. Each transition is logged with timestamp + (if manual) the user who made it.
- Severity derived automatically at creation: `high` if failure rate ≥80% or latency ≥5x baseline, else `medium`.
- An API already has an **open** incident → a new anomaly does not create a duplicate incident or push duplicate events; instead, it increments `anomalyCount` (`$inc`) and updates `lastAnomalyAt` (`$set`) on the existing incident (events are appended strictly on real status transitions: `detected`, `investigating`, `mitigated`, `resolved`).
- Resolving requires the underlying API to currently be passing its last check (can't manually resolve while it's still actively failing) — enforced server-side, not just a UI suggestion.

**Locked decisions:**
- Valid transitions only: `Detected→Investigating`, `Investigating→Mitigated`, `Mitigated→Resolved`, and `Investigating→Resolved` (skip Mitigated is allowed — sometimes an issue just goes away). `Detected→Resolved` directly is **not** allowed — forces at least acknowledgment before closing, which is realistic incident-management practice.

## 6. Real-Time Dashboard

**Requirements:**
- On login, frontend socket connects and joins `org:<id>` room.
- Events emitted: `incident:created`, `incident:updated` (status change), `api:status_changed` (health summary changed — ok→warn, warn→critical, etc.).
- Dashboard subscribes to these events and updates local state directly (no refetch-on-event — the event payload carries enough data to update the UI, per `architecture.md`).
- Connection loss handling: Socket.IO auto-reconnect; on reconnect, frontend does one REST refetch to reconcile any missed events during disconnect (event-only updates would drift if the client was offline).

**Locked decisions:**
- Check-level events (every single health check) are **not** broadcast — only status *changes* and incidents. Broadcasting every check would flood the socket connection for no dashboard benefit.

## 7. (Phase 2) API Dependency Graph
- Admin manually declares edges: "API A depends on API B."
- No cycle validation needed in MVP scope for this feature (a false dependency loop doesn't break anything functionally, just looks odd in the graph) — noted as a known simplification, not fixed unless time allows.

## 8. (Phase 2) Incident Correlation
- Correlation rule: two open incidents are "possibly related" if their APIs have a declared dependency edge AND their `Detected` timestamps are within a 10-minute window.
- Purely additive — correlation never merges incidents, only annotates them with links to related ones. Keeps the incident lifecycle logic from Section 5 untouched.

## 9. (Phase 2) Contract Testing
- Admin uploads/pastes an OpenAPI fragment for a specific endpoint (just the relevant path+method block, not a full spec file, to keep parsing simple).
- Worker validates response status against the spec's declared responses on each check; mismatch logs a `contractViolation: true` flag on the Check record, separate from the pass/fail uptime flag (a 404 might be the *documented* behavior for some inputs — contract violations and uptime failures are conceptually different and must not be conflated).

## 10. (Phase 2) AI Incident Summary
- Triggered manually (a button on the incident detail page), not automatically on every incident — avoids unnecessary API cost and keeps it clearly "assistive," not core logic.
- Input to the LLM: structured JSON (incident, related checks, correlation data if any) — never raw logs, per `prd.md` §4.9.
