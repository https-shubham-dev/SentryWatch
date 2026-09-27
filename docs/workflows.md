# SentryWatch — Workflows

These are end-to-end process narratives — how a real sequence of events moves through the system. Where `architecture.md` §3 showed the *technical* request flow, this shows the *business* flow: what a human (or the system acting on their behalf) actually experiences.

## Workflow 1: Onboarding an API

```
Admin signs up
   → Organization created
   → Admin lands on empty dashboard ("No APIs registered yet")
   → Admin clicks "Add API"
   → Fills: name, method, URL, expected status, interval
   → Submits
   → Backend creates API document (currentStatus: 'unknown')
   → Backend registers a BullMQ repeatable job for this API
   → First check runs within one interval window
   → Dashboard updates (via socket) to currentStatus: 'ok' or 'critical'
```
**Key point to explain:** registration and scheduling are two separate steps that happen in the same request — creating the API document is a Mongo write, registering the job is a Redis/BullMQ operation. If one succeeds and the other fails, you have an inconsistent state. (Worth mentioning as a known edge case — in production you'd wrap this in a saga/compensating-action pattern; for MVP scope, a startup reconciliation job that re-registers jobs for any enabled API missing from the queue is enough.)

## Workflow 2: Normal Health Check Cycle (nothing wrong)

```
Scheduler fires job for API X
   → Worker sends HTTP request
   → Response: 200, 145ms
   → Check record written (passed: true)
   → Rolling stats in Redis updated
   → Anomaly check: 145ms vs rolling avg ~130ms → no anomaly
   → apis.currentStatus already 'ok' → no change → no socket event emitted
```
**Key point:** the "no socket event" branch is deliberate (per `requirements.md` §6) — steady-state healthy checks are silent, which is why the dashboard doesn't flood with noise when everything's fine.

## Workflow 3: An Incident Happens (the core demo flow)

```
API Y starts failing (e.g., deliberately pointed at a dead endpoint for demo)

Check cycle 1:
   Worker → 500 response / timeout
   → Check written (passed: false)
   → Anomaly detection: failure rate over last 5 checks now 20% → below 60% threshold
   → No incident yet, no status change

Check cycle 2 (interval later):
   Worker → still failing
   → Check written (passed: false)
   → Anomaly detection: failure rate now 40% → still below threshold
   → apis.currentStatus: 'ok' → 'warn' (worker detects degradation trend even pre-incident)
   → Socket event: api:status_changed → dashboard row turns amber

Check cycle 3:
   Worker → still failing
   → failure rate now 60% → THRESHOLD CROSSED
   → Anomaly confirmed → check "2 consecutive anomaly cycles" guard
   → This is cycle 1 of the guard (first confirmed anomaly) → not yet enough, logged as warning

Check cycle 4:
   Worker → still failing
   → Anomaly confirmed again → this is cycle 2 → GUARD SATISFIED
   → Incident created: status 'detected', severity derived from failure rate/latency
   → apis.currentStatus → 'critical'
   → Socket event: incident:created → dashboard incident feed updates instantly, row flashes red
```

**This exact sequence is what you should be able to narrate live in an interview or demo** — it's the single most important workflow in the whole project because it proves every architectural decision (queue, anomaly detection, guard logic, real-time push) working together.

## Workflow 4: Developer Investigates and Resolves

```
Member opens incident from live feed
   → Sees: affected API, severity, reason string ("failure rate 80% over last 5 checks"), event timeline
   → Clicks "Start Investigating" → status: detected → investigating
   → (in reality) fixes the underlying issue
   → API starts passing checks again
   → Member attempts "Resolve"
   → Backend validates: is the API's most recent check passing? (requirements.md §5 rule)
        → No: rejected with a clear message ("Can't resolve — API is still failing its last check")
        → Yes: status → resolved, resolvedAt set
   → Socket event: incident:updated → feed reflects resolution
```

## Workflow 5: Contract Violation vs. Uptime Failure (Phase 2)

```
API returns 404 for a request
   → Is 404 the *expected* status for this input per the OpenAPI spec? 
        → Yes: passed: true (uptime-wise, this is correct behavior), contractViolation: false
        → No (spec says 200 expected): passed: false OR contractViolation: true, depending on which check is being evaluated
```
**Key point:** this workflow exists specifically to justify why uptime and contract validation are tracked as separate flags on the Check record (`database.md` §5) rather than one combined "healthy" boolean — a documented 404 is not the same failure mode as an unexpected 500, and conflating them would produce misleading incidents.

## Workflow 6: Incident Correlation (Phase 2)

```
10:40 — Payment API latency anomaly → Incident A created
10:42 — Order API failure anomaly → Incident B created
   → Correlation check runs: does Order API depend on Payment API? (apiDependencies)
        → Yes, AND both incidents detected within 10-minute window
   → Incident B gets relatedIncidentIds: [Incident A._id] (and vice versa)
   → Dashboard shows Incident B with a "Possibly related to Incident A (Payment API)" link
```
No incidents are merged or auto-resolved by correlation — it's purely informational, per `requirements.md` §8.
