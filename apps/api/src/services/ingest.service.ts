import type { Logger } from 'winston'
import type {
  HandoverRequest,
  NormalizedEvent,
  StructuredEvent,
  NightLog,
} from '@night-shift/shared'
import { logPhase } from '../lib/logger.js'
import { isLlmAvailable, callLlmJson } from '../lib/llm.js'
import { approximateTimestampForNightLog } from '../lib/shift.js'

interface ParsedNightIncident {
  id: string
  timestamp: string
  room: string | null
  type: string
  description: string
  status: 'resolved' | 'unresolved' | 'pending'
  originalExcerpt: string
}

interface LlmNightLogParseResult {
  incidents: Array<{
    room: string | null
    type: string
    description: string
    status: 'resolved' | 'unresolved' | 'pending'
    approximateHour: number
    originalExcerpt: string
  }>
}

export interface IngestResult {
  events: NormalizedEvent[]
  parseFlags: string[]
  structuredCount: number
  nightLogCount: number
  parsedCount: number
}

function normalizeStructuredEvent(event: StructuredEvent): NormalizedEvent {
  return {
    id: event.id,
    timestamp: event.timestamp,
    room: event.room,
    type: event.type,
    description: event.description,
    status: event.status,
    source: 'structured',
  }
}

// Rule-based fallback when OPENAI_API_KEY is unset. LLM parsing improves extraction quality for unseen logs.
function parseNightLogRuleBased(
  log: NightLog,
  targetMorning: string,
  timezone: string,
  idOffset: number,
): { incidents: ParsedNightIncident[]; flags: string[] } {
  const flags: string[] = []
  const incidents: ParsedNightIncident[] = []
  let counter = idOffset

  const lines = log.content.split('\n').map((l) => l.trim()).filter(Boolean)
  const bulletLines = lines.filter((l) => l.startsWith('-') || l.startsWith('•'))

  for (const line of bulletLines) {
    const text = line.replace(/^[-•]\s*/, '').trim()
    if (text.length < 10) continue

    const roomMatch = text.match(/\b(?:room\s+)?(\d{3})\b/i) ?? text.match(/(\d{3})\s*房/)
    const room = roomMatch?.[1] ?? null

    let status: 'resolved' | 'unresolved' | 'pending' = 'unresolved'
    if (/settle|resolved|fixed|收了一晚|sorted itself|all fine/i.test(text)) {
      status = /still|not fixed|not settled|no deposit|打不開|jar/i.test(text) ? 'unresolved' : 'resolved'
    }
    if (/flag|reconcile|chase|please|要尽快|passing it on/i.test(text)) {
      status = 'pending'
    }

    let type = 'note'
    if (/leak|drip|wet/i.test(text)) type = 'facilities'
    else if (/aircon|compressor|maintenance|维修|保险箱|safe/i.test(text)) type = 'maintenance'
    else if (/deposit/i.test(text)) type = 'deposit_issue'
    else if (/no-show|no show/i.test(text)) type = 'no_show'
    else if (/wifi/i.test(text)) type = 'complaint'
    else if (/check.?out|billing|in-house|ghost|jar|luggage/i.test(text)) type = 'check_in_issue'
    else if (/check.?in|late arrival/i.test(text)) type = 'check_in'

    let hourHint = 2
    if (/1am|01:|around 1/i.test(text)) hourHint = 1
    else if (/2am|02:/i.test(text)) hourHint = 2
    else if (/3am|03:/i.test(text)) hourHint = 3

    const id = `nlog_${String(counter).padStart(3, '0')}`
    counter += 1

    incidents.push({
      id,
      timestamp: approximateTimestampForNightLog(targetMorning, timezone, hourHint),
      room,
      type,
      description: text,
      status,
      originalExcerpt: text.slice(0, 200),
    })
  }

  if (incidents.length === 0) {
    flags.push('night_log_parse_failed')
  }

  return { incidents, flags }
}

async function parseNightLogWithLlm(
  log: NightLog,
  targetMorning: string,
  timezone: string,
  idOffset: number,
  logger: Logger,
): Promise<{ incidents: ParsedNightIncident[]; flags: string[] }> {
  const start = Date.now()
  const flags: string[] = []

  try {
    const result = await callLlmJson<LlmNightLogParseResult>(
      `You extract discrete hotel front-desk incidents from free-text night shift logs.
Return JSON: { "incidents": [{ "room": string|null, "type": string, "description": string, "status": "resolved"|"unresolved"|"pending", "approximateHour": 0-23, "originalExcerpt": string }] }
Preserve original language in description. Only extract facts stated in the log. Do not invent room numbers.`,
      `Night label: ${log.nightLabel}
Target morning handover date: ${targetMorning}
Timezone offset: ${timezone}

Log content:
${log.content}`,
    )

    logger.info('ingest.night_log_parsed', {
      event: 'ingest.night_log_parsed',
      nightLabel: log.nightLabel,
      extractedCount: result.data.incidents.length,
      durationMs: result.durationMs,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    })

    const incidents = result.data.incidents.map((inc, idx) => ({
      id: `nlog_${String(idOffset + idx).padStart(3, '0')}`,
      timestamp: approximateTimestampForNightLog(targetMorning, timezone, inc.approximateHour),
      room: inc.room,
      type: inc.type,
      description: inc.description,
      status: inc.status,
      originalExcerpt: inc.originalExcerpt,
    }))

    return { incidents, flags }
  } catch (err) {
    logger.warn('ingest.night_log_llm_failed', {
      event: 'ingest.night_log_llm_failed',
      nightLabel: log.nightLabel,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    })
    flags.push('night_log_parse_failed')
    return parseNightLogRuleBased(log, targetMorning, timezone, idOffset)
  }
}

async function parseNightLog(
  log: NightLog,
  targetMorning: string,
  timezone: string,
  idOffset: number,
  logger: Logger,
): Promise<{ incidents: ParsedNightIncident[]; flags: string[] }> {
  if (isLlmAvailable()) {
    return parseNightLogWithLlm(log, targetMorning, timezone, idOffset, logger)
  }

  logger.info('ingest.night_log_rule_based', {
    event: 'ingest.night_log_rule_based',
    nightLabel: log.nightLabel,
    note: 'OPENAI_API_KEY not set — using rule-based parser. Set the key for better extraction on unseen logs.',
  })

  return parseNightLogRuleBased(log, targetMorning, timezone, idOffset)
}

export async function ingestHandoverInput(
  request: HandoverRequest,
  logger: Logger,
): Promise<IngestResult> {
  const structured = request.events.map(normalizeStructuredEvent)
  const parseFlags: string[] = []
  const nightParsed: NormalizedEvent[] = []
  let idOffset = 1

  for (const log of request.nightLogs) {
    const { incidents, flags } = await parseNightLog(
      log,
      request.targetMorning,
      request.hotel.timezone,
      idOffset,
      logger,
    )
    parseFlags.push(...flags)
    idOffset += incidents.length

    for (const inc of incidents) {
      nightParsed.push({
        id: inc.id,
        timestamp: inc.timestamp,
        room: inc.room,
        type: inc.type,
        description: inc.description,
        status: inc.status,
        source: 'night_log',
        originalExcerpt: inc.originalExcerpt,
        nightLabel: log.nightLabel,
      })
    }
  }

  const events = [...structured, ...nightParsed]

  logPhase(logger, 'ingest.complete', {
    structuredCount: structured.length,
    nightLogCount: request.nightLogs.length,
    parsedCount: nightParsed.length,
    totalEvents: events.length,
    parseFlags,
  })

  return {
    events,
    parseFlags,
    structuredCount: structured.length,
    nightLogCount: request.nightLogs.length,
    parsedCount: nightParsed.length,
  }
}
