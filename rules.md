# SentryWatch — Coding Rules

These are hard constraints for whoever (or whatever AI) writes the code. Purpose: keep the codebase in a shape Cyrus can actually read and defend, not a black box.

## 1. General Principles
- Every file does one thing. If a controller file has business logic in it, that's a violation — logic belongs in the service layer.
- No function longer than ~40 lines. If it's longer, it's doing too much — split it.
- Every non-trivial function gets a one-line comment explaining *why*, not *what* (the code already shows what).
- No magic numbers. Thresholds (anomaly %, consecutive failure count, etc.) live in a single `config/thresholds.ts` file with named constants.

## 2. Layering Rules (mirrors Spring Boot discipline)
- **Routes**: only wire HTTP method + path to a controller function. No logic.
- **Controllers**: parse/validate request, call service, shape response. No direct DB or Redis calls.
- **Services**: all business logic lives here. Framework-agnostic where possible (easier to unit test).
- **Models**: Mongoose schemas only. No business logic inside schema methods beyond simple derived fields.

## 3. TypeScript Rules
- `strict: true` in tsconfig — no exceptions.
- No `any`. If a type is genuinely unknown (e.g., third-party API response), define an explicit `unknown` and narrow it.
- All API request/response shapes defined as TypeScript interfaces/types in a shared `types/` folder — frontend and backend should mirror these.

## 4. Database Rules
- Every collection query that touches org data MUST filter by `organizationId`. No exceptions, no "I'll add it later."
- No raw/unindexed queries on collections expected to grow (Checks especially — index on `apiId + createdAt`).
- Use Mongoose transactions only where multi-document consistency actually matters (e.g., incident creation + status log entry together). Don't overuse — most operations here are single-document.

## 5. Queue/Worker Rules
- Every BullMQ job must be idempotent — if the same job runs twice (retry, crash-recovery), it must not create duplicate incidents or duplicate check records with different timestamps than reality.
- Jobs must have a defined retry policy (max attempts, backoff) — never infinite retry.
- Worker logic stays out of route/controller files entirely — workers live in `workers/`, call the same services controllers call, so logic isn't duplicated.

## 6. Anomaly Detection Rules
- Must be pure functions: `(recentChecks: Check[]) => { isAnomaly: boolean; reason: string }`. No side effects, no DB calls inside the detection function itself — this is what makes it unit-testable and explainable.
- Every anomaly decision must produce a human-readable `reason` string (e.g., "latency 840ms vs rolling avg 128ms, 6.5x threshold"). Never a silent boolean-only decision — you need to be able to show *why* an incident fired.

## 7. Error Handling
- One global error-handling middleware. Services throw typed errors (`class NotFoundError`, `class ValidationError`, etc.), controllers never try/catch business errors — they propagate to the global handler.
- Never swallow errors silently. If a worker job fails, log it with enough context (which API, which org, what error) to debug without reproducing.

## 8. Testing Rules
- Anomaly detection service: 100% branch coverage — non-negotiable, this is your "prove it works" module.
- Incident lifecycle transitions: test that invalid transitions are rejected (e.g., can't go Resolved → Detected directly).
- At least one integration test per module covering the happy path end-to-end.

## 9. What NOT to Do (common AI-generated slop to avoid)
- No god files (`utils.ts` with 30 unrelated functions).
- No business logic inside React components — components call hooks/services, hooks call the API client.
- No hardcoded API URLs in frontend — use a single configured `apiClient` (axios instance) with base URL from env.
- No `console.log` left in committed code — use a proper logger (even a simple one) so this looks intentional, not debugged-and-forgotten.
- No commented-out dead code committed.

## 10. Naming Conventions
- Files: `kebab-case.ts`. Classes/Types: `PascalCase`. Variables/functions: `camelCase`. MongoDB collections: plural lowercase (`incidents`, `checks`, `apis`).
