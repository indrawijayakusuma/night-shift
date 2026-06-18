import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Logger } from 'winston'
import { v4 as uuidv4 } from 'uuid'
import { createRequestLogger } from '../lib/logger.js'

export interface RequestWithLog extends Request {
  log: Logger
  requestId: string
  startTime: number
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const extended = req as RequestWithLog
  const requestId = uuidv4()
  extended.requestId = requestId
  extended.startTime = Date.now()
  extended.log = createRequestLogger({ requestId })

  res.setHeader('X-Request-Id', requestId)
  next()
}

export function accessLog(req: Request, res: Response, next: NextFunction): void {
  const extended = req as RequestWithLog

  res.on('finish', () => {
    extended.log.info('http.access', {
      event: 'http.access',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - extended.startTime,
    })
  })

  next()
}

export function enrichRequestContext(
  req: Request,
  fields: { hotelId: string; targetMorning: string },
): void {
  const extended = req as RequestWithLog
  extended.log = createRequestLogger({
    requestId: extended.requestId,
    hotelId: fields.hotelId,
    targetMorning: fields.targetMorning,
  })
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
