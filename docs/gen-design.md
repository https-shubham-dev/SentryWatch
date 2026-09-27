# SentryWatch — Design System

## 1. Grounding
SentryWatch is a **developer observability tool**, used by engineers during stressful moments (something is broken, they're investigating). The design has to read as *calm, precise, technical* — the opposite of a consumer SaaS landing page. Reference points: Grafana panels, Linear's information density, GitHub's dark mode restraint. Not: rounded SaaS-card kits, gradient washes, or playful color.

Avoiding the generic-AI defaults explicitly: no warm cream/terracotta palette, no ALL-CAPS eyebrow labels, no middle-dot meta strings, no '→' on buttons, no identical rounded cards with soft grey shadows on everything.

## 2. Color — Dark Mode First

Base palette (named, not generic):

| Token | Hex | Use |
|---|---|---|
| `ink-950` | `#0A0E14` | App background |
| `ink-900` | `#121821` | Panel/card surface |
| `ink-700` | `#293241` | Borders, dividers |
| `mist-400` | `#8B96A5` | Secondary text |
| `mist-100` | `#E8ECF1` | Primary text |
| `signal-blue` | `#4C8DFF` | Primary actions, links, "info" state |

**Status colors are the design's real accent system** — they carry meaning, not decoration, since this is a monitoring tool:

| State | Hex | Meaning |
|---|---|---|
| `status-ok` | `#3DD68C` | Healthy check |
| `status-warn` | `#F5B84C` | Degraded/investigating |
| `status-critical` | `#F0563D` | Failing/high severity |
| `status-resolved` | `#6C7A91` | Muted, resolved incident |

No other accent color is introduced. Every use of color on the dashboard should map to one of these five semantic states — this restraint is itself the design principle: color = information, not styling.

Light mode: invert to `#F7F8FA` background / `#FFFFFF` panels / same status colors (they already have enough contrast on white).

## 3. Typography

- **UI/body**: `Inter` — neutral, excellent at small sizes for dense data tables, the practical choice for a data-heavy dashboard.
- **Monospace**: `JetBrains Mono` — used *functionally*, not decoratively: API URLs, status codes, latency numbers, endpoint paths. This is a deliberate choice rooted in subject matter (these literally are code/technical values), not a generic "monospace for labels" tic.
- No separate display serif — this isn't an editorial/marketing page, it's a working tool. One type family (Inter) for everything except genuinely technical values.

Type scale:
| Role | Size | Weight |
|---|---|---|
| Page title | 20px | 600 |
| Panel heading | 15px | 600 |
| Body/table text | 13px | 400 |
| Secondary/meta text | 12px | 400 |
| Monospace data (latency, URLs) | 13px | 500 |

## 4. Layout

```
┌─────────────────────────────────────────────┐
│ Top bar: org switcher · nav · user           │
├───────────┬───────────────────────────────────┤
│           │  Overview: status summary strip   │
│  Sidebar  │  (X healthy / Y degraded / Z down)│
│  nav      ├───────────────────────────────────┤
│  (APIs,   │  API list — dense table, sortable │
│  Incidents│  status dot · name · latency ·    │
│  , Settings)│ failure% · last checked          │
│           ├───────────────────────────────────┤
│           │  Incident feed (live-updating)    │
└───────────┴───────────────────────────────────┘
```

- Left-aligned throughout — this is a data tool, not a marketing page; center-alignment would work against scanability.
- Dense, not spacious. Engineers scanning a monitoring dashboard want information density, not generous whitespace — that's a deliberate departure from typical "SaaS landing page" spacing defaults.
- Tables over cards for the API list and check history — cards would waste horizontal space and make comparison across rows harder, which is the opposite of a monitoring tool's job.
- Incident detail view *does* get more breathing room — it's a focused single-record view, not a scanning list, so the density rule relaxes there specifically.

## 5. Structural Devices (used for information, not decoration)
- **Status dot** (4px filled circle, one of the five semantic colors) precedes every API/incident row — the fastest possible visual scan.
- **Incident lifecycle stepper** (Detected → Investigating → Mitigated → Resolved) shown as a horizontal progress line on the incident detail page — this *is* a real sequence, so a stepped/numbered treatment is earned here (unlike decorative 01/02/03 markers elsewhere).
- Borders (`ink-700`, 1px) separate panels — no drop shadows. Flat, technical surface treatment matches the Grafana/Linear reference point.

## 6. Motion
- One deliberate moment: when a new incident arrives via Socket.IO, its row animates in with a brief left-border flash in `status-critical` (200ms), then settles — draws the eye to what changed without being gimmicky.
- No hover animations on every row/card. No page-load fade-ins. Motion only answers a real event (new data arriving), per the "motion responds to action" principle.

## 7. Writing/Copy Voice
- Plain, technical, no marketing tone. "3 APIs degraded" not "Uh oh, something's not right!"
- Incident reason strings are literal and data-backed (this connects directly to `rules.md` §6 — anomaly detection must produce human-readable reasons): "Latency 840ms vs rolling avg 128ms (6.5x threshold)" — not a vague "performance issue detected."
- Empty states are instructive: an org with no registered APIs shows "No APIs registered yet — add one to start monitoring," not a generic illustration.
