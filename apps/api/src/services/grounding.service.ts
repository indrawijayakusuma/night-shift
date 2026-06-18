import type { Logger } from 'winston'
import type {
  DraftHandover,
  HandoverIssue,
  HandoverResponse,
  HandoverSummary,
  Hotel,
  NormalizedEvent,
  SummaryItem,
} from '@night-shift/shared'
import { logPhase } from '../lib/logger.js'

function validSourceIds(events: NormalizedEvent[]): Set<string> {
  return new Set(events.map((e) => e.id))
}

function filterSourceIds(
  sourceIds: string[],
  valid: Set<string>,
): { kept: string[]; removed: string[] } {
  const kept: string[] = []
  const removed: string[] = []
  for (const id of sourceIds) {
    if (valid.has(id)) kept.push(id)
    else removed.push(id)
  }
  return { kept, removed }
}

function verifySummaryItem(
  item: SummaryItem,
  valid: Set<string>,
): { item: SummaryItem | null; flagged: boolean; removed: boolean } {
  const { kept, removed } = filterSourceIds(item.sourceIds, valid)
  const flags = [...item.flags]

  if (removed.length > 0) {
    flags.push('ungrounded_statement_removed')
  }

  if (kept.length === 0) {
    return { item: null, flagged: flags.length > 0, removed: true }
  }

  return {
    item: { ...item, sourceIds: kept, flags },
    flagged: flags.length > 0,
    removed: false,
  }
}

function verifyIssue(
  issue: HandoverIssue,
  valid: Set<string>,
  eventsById: Map<string, NormalizedEvent>,
): { issue: HandoverIssue | null; flagged: boolean; removed: boolean } {
  const { kept, removed } = filterSourceIds(issue.sourceIds, valid)
  const flags = [...issue.flags]

  if (removed.length > 0) {
    flags.push('ungrounded_statement_removed')
  }

  if (kept.length === 0) {
    return { issue: null, flagged: flags.length > 0, removed: true }
  }

  const sourceEvents = kept.map((id) => eventsById.get(id)).filter((e): e is NormalizedEvent => Boolean(e))
  const combinedText = sourceEvents.map((e) => e.description).join(' ').toLowerCase()

  if (issue.title.toLowerCase().includes('room 208') && !combinedText.includes('208')) {
    flags.push('ungrounded_room_claim')
  }
  if (issue.title.toLowerCase().includes('room 215') && !/215|corridor|leak/i.test(combinedText)) {
    flags.push('ungrounded_room_claim')
  }

  return {
    issue: { ...issue, sourceIds: kept, flags },
    flagged: flags.length > 0,
    removed: false,
  }
}

function verifySummarySection(
  items: SummaryItem[],
  valid: Set<string>,
): { items: SummaryItem[]; kept: number; flagged: number; removed: number } {
  let kept = 0
  let flagged = 0
  let removed = 0
  const verified: SummaryItem[] = []

  for (const item of items) {
    const result = verifySummaryItem(item, valid)
    if (result.removed) removed += 1
    else kept += 1
    if (result.flagged) flagged += 1
    if (result.item) verified.push(result.item)
  }

  return { items: verified, kept, flagged, removed }
}

export interface GroundingResult {
  response: Omit<HandoverResponse, 'hotel' | 'targetMorning' | 'generatedAt'>
  kept: number
  flagged: number
  removed: number
}

export function groundHandover(
  draft: DraftHandover,
  events: NormalizedEvent[],
  hotel: Hotel,
  targetMorning: string,
  meta: HandoverResponse['meta'],
  logger: Logger,
): HandoverResponse {
  const valid = validSourceIds(events)
  const eventsById = new Map(events.map((e) => [e.id, e]))

  const urgentResult = verifySummarySection(draft.summary.urgent, valid)
  const pendingResult = verifySummarySection(draft.summary.pending, valid)
  const fyiResult = verifySummarySection(draft.summary.fyi, valid)

  const summary: HandoverSummary = {
    urgent: urgentResult.items,
    pending: pendingResult.items,
    fyi: fyiResult.items,
  }

  const verifiedIssues: HandoverIssue[] = []
  let issueKept = 0
  let issueFlagged = 0
  let issueRemoved = 0

  for (const issue of draft.issues) {
    const result = verifyIssue(issue, valid, eventsById)
    if (result.removed) issueRemoved += 1
    else issueKept += 1
    if (result.flagged) issueFlagged += 1
    if (result.issue) verifiedIssues.push(result.issue)
  }

  const kept = urgentResult.kept + pendingResult.kept + fyiResult.kept + issueKept
  const flagged = urgentResult.flagged + pendingResult.flagged + fyiResult.flagged + issueFlagged
  const removed = urgentResult.removed + pendingResult.removed + fyiResult.removed + issueRemoved

  logPhase(logger, 'grounding.complete', { kept, flagged, removed })

  return {
    hotel,
    targetMorning,
    generatedAt: new Date().toISOString(),
    summary,
    issues: verifiedIssues,
    meta,
  }
}
