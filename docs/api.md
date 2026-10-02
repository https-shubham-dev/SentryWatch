# SentryWatch — API Contract

Base URL: `/api/v1`. All authenticated routes require `Authorization: Bearer <accessToken>`.

## Conventions
- JSON in/out. Timestamps in ISO 8601.
- Errors follow a consistent shape:
```
{
  "error": {
    "code": "NOT_FOUND" | "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "RATE_LIMITED",
    "message": "Human-readable explanation"
  }
}
```
- Standard status codes: `200` (ok), `201` (created), `400` (validation), `401` (missing/invalid token), `403` (wrong role/org), `404` (not found), `409` (conflict — e.g., invalid incident transition), `429` (rate limited / account lockout).
- All list endpoints support `?page=&limit=` (default `limit=20`).
- No endpoint ever accepts a client-supplied `organizationId` — it's always derived server-side from the JWT (per `architecture.md` §7 security notes).

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `{ email, password, orgName }` | Creates User (admin) + Organization. Password must be ≥8 chars with at least one letter and one number (400 if not). Rate limited. |
| POST | `/auth/login` | `{ email, password }` | Returns `{ accessToken }`, sets refresh cookie. After 5 consecutive failed attempts for an email, account is locked 15 minutes (429). Rate limited. |
| POST | `/auth/refresh` | — (cookie) | Returns new `{ accessToken }` |
| POST | `/auth/logout` | — | Clears refresh cookie |
| GET | `/auth/me` | — | Returns `{ user, organization }` |

## APIs (registry)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/apis` | any | List all APIs in org, with `currentStatus` |
| POST | `/apis` | admin | Create — triggers job registration |
| GET | `/apis/:id` | any | Detail |
| PATCH | `/apis/:id` | admin | Update fields (including `enabled` toggle → adds/removes scheduled job) |
| DELETE | `/apis/:id` | admin | Removes job, keeps historical checks/incidents |
| GET | `/apis/:id/checks` | any | Paginated check history, `?limit=` recent checks |
| GET | `/apis/:id/checks/export` | any | PDF export of check history (default last 100 checks; optional `?from=&to=` ISO range). Dark ink/mist themed. `Content-Type: application/pdf` |
| GET | `/apis/:id/stats` | any | Current rolling avg latency, failure rate (reads from Redis, falls back to Mongo aggregation if cache miss) |

## Incidents

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/incidents` | any | List, filterable `?status=&severity=` |
| GET | `/incidents/:id` | any | Detail, includes embedded `events` timeline |
| PATCH | `/incidents/:id/status` | any (member+) | `{ status: 'investigating' \| 'mitigated' \| 'resolved' }` — server validates transition legality (requirements.md §5) and, for `resolved`, that the API's last check passed |

Incidents are never created via API — only the worker's anomaly detection creates them (documented explicitly so it's clear this isn't an oversight).

## Dependencies (Phase 2)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/dependencies` | any | List edges for the graph |
| POST | `/dependencies` | admin | `{ fromApiId, toApiId }` |
| DELETE | `/dependencies/:id` | admin | Remove edge |

## Contract Testing (Phase 2)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/apis/:id/contract` | admin | `{ openApiFragment }` — stores spec fragment for that endpoint |
| DELETE | `/apis/:id/contract` | admin | Removes contract check |

## AI Summary (Phase 2)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/incidents/:id/summarize` | any | Triggers LLM call with structured incident data, returns `{ summary }`. Not cached automatically on the incident — regenerating is allowed (explicitly a manual, on-demand action per `requirements.md` §10) |

## Socket.IO Contract

**Connection:** client connects with `auth: { token: accessToken }`. Server verifies JWT, joins client to room `org:<organizationId>`.

**Server → Client events:**

| Event | Payload | Fired when |
|---|---|---|
| `api:status_changed` | `{ apiId, previousStatus, currentStatus }` | Worker detects a status transition (ok↔warn↔critical) — see `workflows.md` Workflow 3 |
| `incident:created` | `{ incident }` (full object) | Anomaly guard satisfied, new incident created |
| `incident:updated` | `{ incidentId, status, event }` | Any status transition, manual or automatic |

**Client → Server:** none in MVP — this is intentionally one-directional (server pushes, client only listens). No client-initiated socket events needed since all mutations go through REST (`PATCH /incidents/:id/status`, etc.) — keeps the real-time layer simple and the audit trail (who changed what) goes through normal authenticated REST rather than a socket event that's harder to validate/log consistently.

## Rate Limiting
- `/auth/login`, `/auth/signup`: 5 requests/minute per IP (separate buckets per path; dual mounts `/api/v1/auth` and `/api/auth` share the same bucket). Implemented with `express-rate-limit` + Redis store in non-test environments.
- Account lockout (login only): 5 consecutive failed password attempts for an email → 15-minute lock stored in Redis (`auth:lock:<email>`). Returns `429` with a clear message.
- All other authenticated routes: 100 requests/minute per user (generous — this protects against runaway frontend bugs, not normal usage). *Not yet implemented — tracked as future hardening.*

## Explainability Checklist for this file
1. Why incidents have no `POST` endpoint — enforces that they're only ever system-derived, not fabricated by a client.
2. Why sockets are read-only (server→client) — simplifies auth/validation, keeps mutations auditable through REST.
3. Why `organizationId` never comes from the client in any request body.
