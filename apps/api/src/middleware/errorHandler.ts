import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import type { RequestWithLog } from './requestContext.js'
import { rootLogger } from '../lib/logger.js'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const extended = req as RequestWithLog
  const logger = extended.log ?? rootLogger

  if (err instanceof AppError) {
    const level = err.statusCode >= 500 ? 'error' : 'warn'
    logger.log(level, 'handover.error', {
      event: 'handover.error',
      errorCode: err.code,
      message: err.message,
      phase: err.phase,
      statusCode: err.statusCode,
      stack: err.statusCode >= 500 ? err.stack : undefined,
    })
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        phase: err.phase,
      },
    })
    return
  }

  logger.error('handover.error', {
    event: 'handover.error',
    errorCode: 'INTERNAL_ERROR',
    message: err.message,
    stack: err.stack,
  })

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  })
}
