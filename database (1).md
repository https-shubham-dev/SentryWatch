# SentryWatch — Database Design (MongoDB)

## 1. Collections Overview

```
organizations
    │
    ├── users            (organizationId)
    ├── apis             (organizationId)
    │      │
    │      ├── checks         (apiId, organizationId)
    │      └── incidents      (apiId, organizationId)
    │              └── incidentEvents (embedded — see §5)
    └── apiDependencies (organizationId)   [Phase 2]
```

Every collection except `organizations` itself carries `organizationId` — this is the multi-tenancy enforcement point referenced in `architecture.md` §6 and `rules.md` §4.

## 2. Schema: `organizations`
```
{
  _id: ObjectId,
  name: String,
  createdAt: Date
}
```

## 3. Schema: `users`
```
{
  _id: ObjectId,
  organizationId: ObjectId,   // indexed
  email: String,              // unique
  passwordHash: String,
  role: 'admin' | 'member',
  createdAt: Date
}
```
Index: `{ email: 1 }` unique. `{ organizationId: 1 }`.

## 4. Schema: `apis`
```
{
  _id: ObjectId,
  organizationId: ObjectId,
  name: String,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: String,
  expectedStatus: Number,
  headers: Object,            // optional, small key-value map
  checkIntervalSeconds: Number,  // 60 | 300 | 900
  enabled: Boolean,
  currentStatus: 'ok' | 'warn' | 'critical' | 'unknown',  // denormalized — see §7
  createdAt: Date,
  updatedAt: Date
}
```
Index: `{ organizationId: 1 }`. `{ organizationId: 1, enabled: 1 }` (scheduler queries enabled APIs per org on boot).

## 5. Schema: `checks`
This is the highest-volume collection — a new document roughly every `checkIntervalSeconds` per API.
```
{
  _id: ObjectId,
  apiId: ObjectId,
  organizationId: ObjectId,
  scheduledTime: Date,     // used for idempotency key (apiId + scheduledTime)
  executedAt: Date,
  statusCode: Number | null,
  passed: Boolean,
  latencyMs: Number | null,
  errorType: 'network' | 'timeout' | null,
  contractViolation: Boolean   // Phase 2, defaults false
}
```
Indexes:
- `{ apiId: 1, executedAt: -1 }` — this is the critical index. Every rolling-window calculation and every "check history" view queries by this.
- `{ apiId: 1, scheduledTime: 1 }` unique — enforces the idempotency rule from `requirements.md` §3 at the database level, not just in application logic. This is the single most important index in the whole schema to be able to explain: it's what makes "duplicate job run after crash" structurally impossible rather than just "handled in code."

**Why MongoDB (not Postgres) for this collection specifically:** check documents have a simple, uniform, append-mostly shape with no complex joins needed at write time — a natural fit for a document store, and it's genuinely the right tool here, not just "because MERN."

## 6. Schema: `incidents`
```
{
  _id: ObjectId,
  apiId: ObjectId,
  organizationId: ObjectId,
  status: 'detected' | 'investigating' | 'mitigated' | 'resolved',
  severity: 'medium' | 'high',
  reason: String,             // human-readable, from anomaly detection — see requirements.md §4
  detectedAt: Date,
  lastAnomalyAt: Date,        // updated ($set) on repeated anomaly cycles
  anomalyCount: Number,       // incremented ($inc) on repeated anomaly cycles
  resolvedAt: Date | null,
  relatedIncidentIds: [ObjectId],  // Phase 2 correlation
  events: [ IncidentEvent ]   // embedded, see §7 below
}
```
Index: `{ organizationId: 1, status: 1 }` (dashboard's "open incidents" query). `{ apiId: 1, status: 1 }` (used by the duplicate-incident guard in requirements.md §5).

## 7. Embedded: `IncidentEvent`
Embedded rather than a separate collection — an incident's event history is always read *with* the incident (the timeline view), never independently, and the array stays small (a handful of status transitions per incident, not thousands). Incident events are appended strictly on real status transitions (`detected`, `investigating`, `mitigated`, `resolved`). For repeated anomaly cycles on an already-open incident, events are not pushed; instead `anomalyCount` is incremented (`$inc`) and `lastAnomalyAt` is updated (`$set`). This is the correct embed-vs-reference call: embed when data is always accessed together and bounded in size; reference (as done for `checks`) when data is high-volume and queried independently.
```
{
  status: 'detected' | 'investigating' | 'mitigated' | 'resolved',
  timestamp: Date,
  triggeredBy: 'system' | ObjectId  // 'system' for auto-detection, userId for manual transitions
}
```

## 8. Denormalization Decision: `apis.currentStatus`
The API document stores a denormalized `currentStatus` field, updated by the worker after every check, instead of always computing it live from the `checks` collection.

**Why:** the API list view (the main dashboard table) needs to render current status for potentially dozens of APIs instantly, on every page load and every real-time update. Computing "status from last check" via a query-per-row would be needlessly expensive when the worker already knows the answer at write time. This is a deliberate, explainable trade-off (a small write-time cost for a much cheaper, more frequent read) — not an accidental inconsistency risk, since only the worker ever writes this field.

## 9. Schema: `apiDependencies` (Phase 2)
```
{
  _id: ObjectId,
  organizationId: ObjectId,
  fromApiId: ObjectId,   // depends on...
  toApiId: ObjectId
}
```
Index: `{ organizationId: 1 }`.

## 10. Redis Data (not MongoDB, but part of the data layer)
- `rolling:<apiId>` — list/sorted-set of recent check results (latency, pass/fail), capped at 20 entries, used by anomaly detection for O(1)-ish reads instead of a Mongo query on every check cycle.
- BullMQ's own internal queue/job state (managed by the library, not hand-rolled).

## 11. What You Must Be Able to Explain (minimum bar)
1. Why `checks` uses a compound unique index on `apiId + scheduledTime` (idempotency, not just app-level checking).
2. The embed-vs-reference decision for `IncidentEvent` vs. `checks` — this is a classic MongoDB design question and you now have a real, defensible answer.
3. Why `currentStatus` is denormalized on `apis` — read/write trade-off reasoning.
