import type { Request, Response } from 'express'
import type { HandoverRequest } from '@night-shift/shared'
import { ingestHandoverInput } from '../services/ingest.service.js'
import { reconcileEvents } from '../services/reconcile.service.js'
import { generateHandover } from '../services/generate.service.js'
import { groundHandover } from '../services/grounding.service.js'
import {
  enrichRequestContext,
  type RequestWithLog,
} from '../middleware/requestContext.js'
import { logPhase } from '../lib/logger.js'
import { AppError } from '../errors/AppError.js'

export async function createHandover(req: Request, res: Response): Promise<void> {
  const extended = req as RequestWithLog
  const body = req.body as HandoverRequest
  const start = Date.now()

  enrichRequestContext(req, {
    hotelId: body.hotel.id,
    targetMorning: body.targetMorning,
  })

  logPhase(extended.log, 'handover.request', {
    method: req.method,
    path: req.path,
    hotelId: body.hotel.id,
    targetMorning: body.targetMorning,
  })

  try {
    const ingested = await ingestHandoverInput(body, extended.log)
    const reconciled = reconcileEvents(
      ingested.events,
      body.hotel,
      body.targetMorning,
      extended.log,
    )

    const draft = await generateHandover(
      reconciled.threads,
      body.targetMorning,
      extended.log,
    )

    const notes = [...reconciled.notes, ...ingested.parseFlags]
    const response = groundHandover(
      draft,
      ingested.events,
      body.hotel,
      body.targetMorning,
      {
        eventCount: ingested.structuredCount,
        nightLogCount: ingested.nightLogCount,
        reconciliationNotes: notes,
      },
      extended.log,
    )

    logPhase(extended.log, 'handover.complete', {
      statusCode: 200,
      totalDurationMs: Date.now() - start,
      issueCount: response.issues.length,
    })

    res.status(200).json(response)
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError(
      err instanceof Error ? err.message : 'Handover pipeline failed',
      500,
      'PIPELINE_ERROR',
      true,
      'handover',
    )
  }
}

export function healthCheck(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', service: 'night-shift-api' })
}
