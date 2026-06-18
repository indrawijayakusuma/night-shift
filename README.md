# Night Shift — API testing

The API runs on **port 3001** by default and exposes two endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `POST` | `/handover` | Generate a morning handover from events + night logs |

---

## 1. Start the API

From the repo root:

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY (optional — falls back to rule-based logic without it)

npm install
npm run dev -w @night-shift/api
```

Or run API and web together:

```bash
npm run dev
```

The API listens at `http://localhost:3001`.

---

## 2. Health check

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{ "status": "ok", "service": "night-shift-api" }
```

---

## 3. Generate a handover

`POST /handover` accepts JSON with:

- `hotel` — `id`, `name`, `timezone` (e.g. `"+08:00"`)
- `events` — structured front-desk events
- `nightLogs` — free-text relief logs (can be an empty array)
- `targetMorning` — ISO date (`YYYY-MM-DD`) for the morning handover

### Quick test with curl

```bash
curl -X POST http://localhost:3001/handover \
  -H "Content-Type: application/json" \
  -d '{
    "hotel": {
      "id": "lumen-sg",
      "name": "Lumen Boutique Hotel",
      "timezone": "+08:00"
    },
    "events": [],
    "nightLogs": [],
    "targetMorning": "2026-05-28"
  }'
```

With an empty payload you get a valid (mostly empty) handover. For realistic output, use the bundled sample data below.

### Full sample (bundled data)

The repo includes sample data in `data/events.json` and `data/night-logs.md`. Run the verification script:

```bash
node scripts/verify-handover.mjs
```

This POSTs the full event history plus the Wed 27 May relief night log and prints a summary to the terminal.

### Manual curl with sample files

On Linux/macOS:

```bash
curl -X POST http://localhost:3001/handover \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "hotel": {
    "id": "lumen-sg",
    "name": "Lumen Boutique Hotel",
    "timezone": "+08:00"
  },
  "events": [],
  "nightLogs": [
    {
      "nightLabel": "Wed 27 May → morning Thu 28 May",
      "content": "Room 112 aircon still out of order. Leak near 215 got worse — bucket placed, building management contacted."
    }
  ],
  "targetMorning": "2026-05-28"
}
EOF
```

Paste the `events` array from `data/events.json` for the full reconciliation test.

---

## 4. Response shape

A successful `200` response looks like:

```json
{
  "hotel": { "id": "lumen-sg", "name": "Lumen Boutique Hotel", "timezone": "+08:00" },
  "targetMorning": "2026-05-28",
  "generatedAt": "2026-05-28T07:00:00.000+08:00",
  "summary": {
    "urgent": [{ "title": "...", "action": "...", "sourceIds": ["evt_0008"], "flags": [] }],
    "pending": [],
    "fyi": []
  },
  "issues": [
    {
      "category": "new_tonight",
      "priority": "urgent",
      "title": "...",
      "action": "...",
      "sourceIds": ["evt_0008", "nlog_002"],
      "flags": []
    }
  ],
  "meta": {
    "eventCount": 26,
    "nightLogCount": 1,
    "reconciliationNotes": []
  }
}
```

**`sourceIds`** trace each item back to input records (`evt_*` = structured events, `nlog_*` = parsed night-log bullets).

**`flags`** highlight contradictions or grounding issues (e.g. structured vs relief-log mismatch).

---

## 5. Error responses

Validation errors (`400`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "phase": "validate"
  }
}
```

Server errors (`500`):

```json
{
  "error": {
    "code": "PIPELINE_ERROR",
    "message": "...",
    "phase": "handover"
  }
}
```

---

## 6. Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | API listen port |
| `OPENAI_API_KEY` | — | Enables LLM parsing + generation (optional) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for LLM steps |
| `LOG_LEVEL` | `info` | Winston log level |
| `LOG_PRETTY` | `true` | Human-readable logs in dev |

Without `OPENAI_API_KEY`, the API uses deterministic rule-based parsing and handover assembly.

---

## 7. Pretty-print response (optional)

```bash
curl -s -X POST http://localhost:3001/handover \
  -H "Content-Type: application/json" \
  -d @payload.json | jq .
```

Save a request body to `payload.json`, or pipe the verify script output through `jq` by adapting `scripts/verify-handover.mjs`.
