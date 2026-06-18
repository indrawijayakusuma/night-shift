# DECISIONS.md — Night-Shift Handover

## What I built (and what I skipped)

### Built

- **Monorepo** (`apps/api`, `apps/web`, `packages/shared`) with npm workspaces
- **`POST /handover`** — ingest → reconcile → generate → grounding pipeline
- **`GET /health`** — deploy probe
- **Next.js UI** — date picker, sample data loader, action-first handover display
- **Winston structured logging** — request-scoped child loggers with phase events (`ingest.complete`, `reconcile.complete`, `generate.*`, `grounding.complete`)
- **Shared Zod contracts** — `@night-shift/shared` for request/response validation

### Deliberately skipped (and why)

| Skipped | Why |
|---------|-----|
| Database / persistence | Brief assumes input arrives as data per request; 2-hour scope |
| Auth / multi-tenant routing | Not required for the test slice |
| Automated test suite | Time tradeoff; manual verification via `scripts/verify-handover.mjs` |
| Deployment | Planned follow-up (Railway/Render + Vercel) |
| Slack/email output | JSON + web UI chosen as simplest viewable format |
| Per-hotel config UI | Single-hotel sample data sufficient for demo |

---

## Reconciliation across nights

Night shifts are modeled as **23:00 → 07:00** in the hotel timezone (`apps/api/src/lib/shift.ts`, Luxon).

1. **Normalize** structured JSON events + parsed relief-log incidents into `NormalizedEvent[]`
2. **Thread** related events by `(room, issueKind)` using regex classifiers in `reconcile.service.ts` — aircon, leak, deposit, safe, ghost guest, etc.
3. **Categorize** each thread for the target morning:
   - `still_open` — seen before target night, unresolved after
   - `newly_resolved` — was open, resolved during target night
   - `new_tonight` — first appearance during target night
4. **Prioritize** — guest-blocking/safety → `urgent`; operational → `pending`; resolved/FYI → `fyi`
5. **Flag contradictions** when structured events and relief-log entries disagree on status or charges (e.g. room 312 no-show: structured says "NOT yet charged", relief log says fee collected)

I do **not** re-report every open item from scratch — threads carry history via `sourceIds[]` on each issue.

---

## Grounding and handling messy input

### Pipeline

1. **Ingest** — night logs parsed by LLM (JSON schema) or rule-based bullet extractor; synthetic IDs (`nlog_001`, …)
2. **Reconcile** — deterministic threading; contradictions get explicit `flags`
3. **Generate** — LLM rewrites reconciled threads into action-first JSON, or rule-based assembly when no API key
4. **Ground** (`grounding.service.ts`) — post-generation verification:
   - Every `sourceId` must exist in ingested events
   - Items with zero valid citations are **removed** (`ungrounded_statement_removed`)
   - Spot-checks for room-number claims vs source text (`ungrounded_room_claim`)

### Incomplete / contradictory input

- **Unknown room** (WiFi complaint) → included with flag, not invented
- **Multilingual relief log** → original language preserved in descriptions; handover text in English
- **Structured vs relief conflicts** → surfaced as `contradiction_status` / `contradiction_charge` flags, not silently resolved

### Stopping the model inventing facts

- LLM only sees **reconciled threads + source excerpts**, not raw full dumps
- Prompt requires `sourceIds` from input only
- **Grounding layer** is the hard gate — unverifiable output is dropped regardless of model confidence
- Rule-based fallback runs without any LLM when `OPENAI_API_KEY` is unset

---

## Where AI helped vs got in the way

| Helped | Got in the way |
|--------|----------------|
| Parsing messy multilingual relief logs into structured incidents | Without a key, rule-based parsing misses nuance (e.g. paragraph-style items without `-` bullets) |
| Improving handover phrasing and urgency grouping | LLM can duplicate items across summary sections if not grounded carefully |
| Planning/scaffolding the monorepo via Cursor | Parallel agent work needed consolidation (env access style, shared schema layout) |

---

## Hours 3–6 (if I had them)

1. **Deploy** API + web with env-based config
2. **Unit tests** for shift boundaries, thread merging, contradiction detection
3. **Stronger night-log parser** — paragraph segmentation, multilingual LLM with structured output schema
4. **Hotel-agnostic issue kinds** — reduce regex hardcoding; embed-based similarity for thread matching
5. **Evaluation harness** — golden handovers per date with automated grounding checks
6. **Observability** — log correlation IDs to a dashboard; bad-handover replay from stored inputs

---

## One thing that surprised me

Relief-log vs structured **contradictions are features, not bugs**. Room 312 (no-show charged in prose vs "NOT yet charged" in JSON) is exactly what a morning manager needs flagged — building explicit `contradiction_*` flags was more valuable than trying to auto-resolve them.
