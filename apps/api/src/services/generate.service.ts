import type { Logger } from 'winston'
import type {
  DraftHandover,
  HandoverIssue,
  HandoverSummary,
  IssueThread,
  SummaryItem,
} from '@night-shift/shared'
import { logPhase } from '../lib/logger.js'
import { isLlmAvailable, callLlmJson } from '../lib/llm.js'

interface LlmHandoverDraft {
  summary: HandoverSummary
  issues: HandoverIssue[]
}

function threadToIssue(thread: IssueThread): HandoverIssue {
  return {
    category: thread.category,
    priority: thread.priority,
    title: thread.title,
    action: thread.action,
    sourceIds: thread.sourceIds,
    flags: thread.flags,
  }
}

function threadToSummaryItem(thread: IssueThread): SummaryItem {
  return {
    title: thread.title,
    action: thread.action,
    sourceIds: thread.sourceIds,
    flags: thread.flags,
  }
}

// Deterministic handover assembly when OPENAI_API_KEY is unset. LLM generation improves phrasing and prioritization.
function generateRuleBased(threads: IssueThread[]): DraftHandover {
  const urgent: SummaryItem[] = []
  const pending: SummaryItem[] = []
  const fyi: SummaryItem[] = []

  for (const thread of threads) {
    const item = threadToSummaryItem(thread)
    if (thread.priority === 'urgent') urgent.push(item)
    else if (thread.priority === 'fyi') fyi.push(item)
    else pending.push(item)
  }

  return {
    summary: { urgent, pending, fyi },
    issues: threads.map(threadToIssue),
  }
}

async function generateWithLlm(
  threads: IssueThread[],
  targetMorning: string,
  logger: Logger,
): Promise<DraftHandover> {
  const threadPayload = threads.map((t) => ({
    category: t.category,
    priority: t.priority,
    title: t.title,
    action: t.action,
    sourceIds: t.sourceIds,
    flags: t.flags,
    excerpts: t.events.map((e) => ({
      id: e.id,
      source: e.source,
      description: e.description,
      status: e.status,
    })),
  }))

  const result = await callLlmJson<LlmHandoverDraft>(
    `You produce action-first hotel morning handover JSON for a front-desk manager.
Output shape: { "summary": { "urgent": [], "pending": [], "fyi": [] }, "issues": [] }
Each summary item and issue must include title, action, sourceIds (from input only), flags.
Write all title and action text in English, even when source excerpts are in another language.
Group by urgency: guest-blocking/safety → urgent, operational follow-ups → pending, resolved/FYI → fyi.
Never invent facts or sourceIds. Preserve contradiction flags from input.`,
    `Target morning: ${targetMorning}

Reconciled issue threads:
${JSON.stringify(threadPayload, null, 2)}`,
  )

  logPhase(logger, 'generate.llm_call', {
    model: result.model,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    durationMs: result.durationMs,
  })

  return result.data
}

export async function generateHandover(
  threads: IssueThread[],
  targetMorning: string,
  logger: Logger,
): Promise<DraftHandover> {
  if (isLlmAvailable()) {
    try {
      return await generateWithLlm(threads, targetMorning, logger)
    } catch (err) {
      logger.warn('generate.llm_fallback', {
        event: 'generate.llm_fallback',
        error: err instanceof Error ? err.message : String(err),
        note: 'Falling back to rule-based generation',
      })
    }
  } else {
    logger.info('generate.rule_based', {
      event: 'generate.rule_based',
      note: 'OPENAI_API_KEY not set — using rule-based generation. Set the key for improved phrasing and prioritization.',
    })
  }

  return generateRuleBased(threads)
}
