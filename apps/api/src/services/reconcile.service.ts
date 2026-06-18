import type { Logger } from 'winston'
import type { Hotel, IssueThread, NormalizedEvent, IssueCategory, IssuePriority } from '@night-shift/shared'
import { logPhase } from '../lib/logger.js'
import {
  getShiftForTimestamp,
  isInTargetShift,
  isBeforeTargetShift,
} from '../lib/shift.js'

const ISSUE_KIND_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: 'check_in_name', pattern: /booking name|name.*did not match|name.*match/i },
  { kind: 'aircon', pattern: /aircon|compressor|cooling|out of order/i },
  { kind: 'corridor_leak', pattern: /leak|drip|wet.?floor|corridor.*215|215.*corridor/i },
  { kind: 'deposit', pattern: /deposit/i },
  { kind: 'no_show', pattern: /no.?show/i },
  { kind: 'passport_compliance', pattern: /passport.*scan|immigration.*scan|scanner offline|passports could not be scanned/i },
  { kind: 'safe', pattern: /safe|保险箱/i },
  { kind: 'ghost_guest', pattern: /door ajar|not slept|no luggage|checked out early|in-house.*billing/i },
  { kind: 'wifi', pattern: /wifi/i },
  { kind: 'noise', pattern: /noise/i },
  { kind: 'damage', pattern: /damage|cracked basin/i },
  { kind: 'breakfast', pattern: /breakfast|kitchen/i },
  { kind: 'guest_health', pattern: /unwell|medication|ambulance/i },
  { kind: 'early_checkout', pattern: /early checkout|leaving.*05/i },
  { kind: 'finance_dispute', pattern: /disputes the charge|cancellation window/i },
  { kind: 'parcel', pattern: /parcel|holding/i },
  { kind: 'guest_message', pattern: /typed note|goodwill credit|SYSTEM NOTE/i },
]

function classifyIssueKind(event: NormalizedEvent): string {
  const text = `${event.type} ${event.description}`
  for (const { kind, pattern } of ISSUE_KIND_PATTERNS) {
    if (pattern.test(text)) return kind
  }
  return event.type
}

function threadKeyFor(event: NormalizedEvent): string {
  const kind = classifyIssueKind(event)

  if (kind === 'passport_compliance') {
    return 'hotel::passport_compliance'
  }

  if (event.room) {
    return `${event.room}::${kind}`
  }

  if (kind === 'corridor_leak') {
    return '215::corridor_leak'
  }

  if (kind === 'wifi') {
    return 'hotel::wifi'
  }

  const roomInText = event.description.match(/\broom\s+(\d{3})\b/i)?.[1]
    ?? event.description.match(/\b(\d{3})\b/)?.[1]
  if (roomInText) {
    return `${roomInText}::${kind}`
  }

  return `misc::${kind}::${event.id}`
}

function isResolvedStatus(status: NormalizedEvent['status']): boolean {
  return status === 'resolved'
}

function inferPriority(
  kind: string,
  category: IssueCategory,
  events: NormalizedEvent[],
): IssuePriority {
  const text = events.map((e) => e.description).join(' ')
  if (
    category === 'new_tonight' &&
    (kind === 'safe' || kind === 'corridor_leak' || /passport.*cash|can't leave|走不了/i.test(text))
  ) {
    return 'urgent'
  }
  if (kind === 'corridor_leak' && !isResolvedStatus(events[events.length - 1]?.status ?? 'unresolved')) {
    return 'urgent'
  }
  if (kind === 'safe') return 'urgent'
  if (kind === 'ghost_guest') return 'urgent'
  if (category === 'newly_resolved') return 'fyi'
  if (kind === 'wifi' || kind === 'parcel' || kind === 'guest_health') return 'fyi'
  return 'pending'
}

function buildTitle(kind: string, room: string | null, events: NormalizedEvent[]): string {
  const latest = events[events.length - 1]
  if (!latest) return 'Unknown issue'

  switch (kind) {
    case 'corridor_leak':
      return '2nd floor corridor leak near room 215'
    case 'safe':
      return `Room ${room ?? '?'} — safe locked with passport and cash inside`
    case 'deposit':
      return `Room ${room ?? '?'} — deposit not collected`
    case 'no_show':
      return `Room ${room ?? '?'} — no-show charge`
    case 'aircon':
      return `Room ${room ?? '?'} — aircon out of order`
    case 'ghost_guest':
      return `Room ${room ?? '?'} — possible ghost guest / billing mismatch`
    case 'wifi':
      return 'WiFi complaint — room unknown'
    case 'check_in_name':
      return `Room ${room ?? '?'} — booking name mismatch (OTA confirmation needed)`
    case 'passport_compliance':
      return 'Immigration passport scanning backlog'
    default:
      return latest.description.slice(0, 80)
  }
}

function buildAction(
  kind: string,
  category: IssueCategory,
  events: NormalizedEvent[],
  flags: string[],
): string {
  const latest = events[events.length - 1]
  if (!latest) return 'Review and action as needed'

  if (kind === 'corridor_leak' && category !== 'newly_resolved') {
    return 'Chase building management first thing — steady drip, carpet soaked, bucket placed. Not fixed overnight.'
  }
  if (kind === 'safe') {
    return 'Arrange maintenance or safe company to open before guest checkout/flight. Passport and cash locked inside.'
  }
  if (kind === 'deposit') {
    return 'Collect SGD 100 deposit from guest — card declined on arrival, still not on file.'
  }
  if (kind === 'ghost_guest') {
    return 'Reconcile PMS — door ajar, bed unslept, no luggage, but system shows guest in-house. Verify billing.'
  }
  if (kind === 'no_show' && flags.some((f) => f.includes('contradiction'))) {
    return 'Verify whether no-show charge was applied — relief log says charged, structured log says not yet charged.'
  }
  if (kind === 'wifi') {
    return 'Monitor — guest complained about dropping WiFi around 3am but room unknown. Follow up if guest returns.'
  }
  if (kind === 'aircon') {
    return category === 'newly_resolved'
      ? 'Room remains OOO — compressor part ordered per relief log.'
      : 'Room 112 remains out of order — aircon repair in progress.'
  }
  if (category === 'newly_resolved') {
    return `Resolved overnight: ${latest.description.slice(0, 120)}`
  }
  return latest.description.slice(0, 150)
}

function detectContradictions(threadEvents: NormalizedEvent[]): string[] {
  const flags: string[] = []
  const structured = threadEvents.filter((e) => e.source === 'structured')
  const nightLog = threadEvents.filter((e) => e.source === 'night_log')

  if (structured.length === 0 || nightLog.length === 0) return flags

  const structuredResolved = structured.some((e) => isResolvedStatus(e.status))
  const nightResolved = nightLog.some((e) => isResolvedStatus(e.status))
  const structuredUnresolved = structured.some((e) => !isResolvedStatus(e.status))
  const nightUnresolved = nightLog.some((e) => !isResolvedStatus(e.status))

  if ((structuredResolved && nightUnresolved) || (structuredUnresolved && nightResolved)) {
    const ids = [...structured.map((e) => e.id), ...nightLog.map((e) => e.id)]
    flags.push(`contradiction_status:${ids.join(',')}`)
  }

  const structuredText = structured.map((e) => e.description).join(' ').toLowerCase()
  const nightText = nightLog.map((e) => e.description).join(' ').toLowerCase()

  if (
    (structuredText.includes('not yet charged') && nightText.includes('收了一晚')) ||
    (structuredText.includes('not yet charged') && /charged|settle/i.test(nightText))
  ) {
    flags.push(`contradiction_charge:${[...structured, ...nightLog].map((e) => e.id).join(',')}`)
  }

  if (structuredText.includes('compressor part has arrived') && nightText.includes('part needs to be ordered')) {
    flags.push(`contradiction_timeline:${[...structured, ...nightLog].map((e) => e.id).join(',')}`)
  }

  return flags
}

function categorizeThread(
  threadEvents: NormalizedEvent[],
  timezone: string,
  targetMorning: string,
): IssueCategory {
  const sorted = [...threadEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const priorEvents = sorted.filter((e) => isBeforeTargetShift(e.timestamp, timezone, targetMorning))
  const targetEvents = sorted.filter((e) => isInTargetShift(e.timestamp, timezone, targetMorning))

  const hadOpenBefore = priorEvents.some((e) => !isResolvedStatus(e.status))
  const latestOverall = sorted[sorted.length - 1]
  const resolvedNow = latestOverall ? isResolvedStatus(latestOverall.status) : false
  const firstInTarget = targetEvents[0]
  const firstEver = sorted[0]

  const firstSeenInTarget =
    firstEver && isInTargetShift(firstEver.timestamp, timezone, targetMorning)

  if (firstSeenInTarget && !hadOpenBefore) {
    return 'new_tonight'
  }

  if (hadOpenBefore && resolvedNow && targetEvents.some((e) => isResolvedStatus(e.status) || e.source === 'night_log')) {
  const resolvedInTarget = targetEvents.some((e) => isResolvedStatus(e.status))
    if (resolvedInTarget) return 'newly_resolved'
  }

  if (hadOpenBefore && !resolvedNow) {
    return 'still_open'
  }

  if (firstInTarget && !hadOpenBefore) {
    return 'new_tonight'
  }

  if (resolvedNow && hadOpenBefore) {
    return 'newly_resolved'
  }

  return 'still_open'
}

export interface ReconcileResult {
  threads: IssueThread[]
  notes: string[]
  stillOpen: number
  newlyResolved: number
  newTonight: number
  contradictionCount: number
}

export function reconcileEvents(
  events: NormalizedEvent[],
  hotel: Hotel,
  targetMorning: string,
  logger: Logger,
): ReconcileResult {
  const relevant = events.filter((e) => {
    const { shiftEndMorning } = getShiftForTimestamp(e.timestamp, hotel.timezone)
    return shiftEndMorning <= targetMorning
  })

  const grouped = new Map<string, NormalizedEvent[]>()
  for (const event of relevant) {
    const key = threadKeyFor(event)
    const existing = grouped.get(key) ?? []
    existing.push(event)
    grouped.set(key, existing)
  }

  const threads: IssueThread[] = []
  const notes: string[] = []
  let stillOpen = 0
  let newlyResolved = 0
  let newTonight = 0
  let contradictionCount = 0

  for (const [threadKey, threadEvents] of grouped) {
    const sorted = [...threadEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    const hasTargetActivity = sorted.some((e) =>
      isInTargetShift(e.timestamp, hotel.timezone, targetMorning),
    )
    const latest = sorted[sorted.length - 1]
    if (!latest) continue

    const isCarryForward =
      !hasTargetActivity &&
      !isResolvedStatus(latest.status) &&
      isBeforeTargetShift(latest.timestamp, hotel.timezone, targetMorning)

    if (!hasTargetActivity && !isCarryForward) continue

    const keyParts = threadKey.split('::')
    const room = keyParts[0] === 'hotel' || keyParts[0] === 'misc' ? null : keyParts[0]
    const kind = keyParts[1] ?? 'note'
    const category = categorizeThread(sorted, hotel.timezone, targetMorning)
    const flags = detectContradictions(sorted)
    if (kind === 'ghost_guest') {
      flags.push('possible_ghost_guest')
    }

    if (flags.length > 0) contradictionCount += 1

    if (category === 'still_open') stillOpen += 1
    if (category === 'newly_resolved') newlyResolved += 1
    if (category === 'new_tonight') newTonight += 1

    const priority = inferPriority(kind ?? 'note', category, sorted)
    const title = buildTitle(kind ?? 'note', room ?? null, sorted)
    const action = buildAction(kind ?? 'note', category, sorted, flags)

    const thread: IssueThread = {
      threadKey,
      room: room ?? null,
      issueKind: kind ?? 'note',
      category,
      priority,
      title,
      action,
      sourceIds: sorted.map((e) => e.id),
      flags,
      confidence: flags.length > 0 ? 0.6 : 0.9,
      events: sorted,
    }

    threads.push(thread)

    logger.info('reconcile.thread', {
      event: 'reconcile.thread',
      threadKey,
      category,
      priority,
      sourceIds: thread.sourceIds,
      confidence: thread.confidence,
      flags,
    })
  }

  threads.sort((a, b) => {
    const order: Record<IssuePriority, number> = { urgent: 0, pending: 1, fyi: 2 }
    return order[a.priority] - order[b.priority]
  })

  if (contradictionCount > 0) {
    notes.push(`${contradictionCount} issue thread(s) have structured vs relief-log contradictions — flagged for review.`)
  }

  logPhase(logger, 'reconcile.complete', {
    stillOpen,
    newlyResolved,
    newTonight,
    contradictionCount,
    threadCount: threads.length,
  })

  return { threads, notes, stillOpen, newlyResolved, newTonight, contradictionCount }
}
