import winston from 'winston'

const isProduction = process.env['NODE_ENV'] === 'production'
const logPretty = process.env['LOG_PRETTY'] === 'true'

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
)

const jsonFormat = winston.format.combine(baseFormat, winston.format.json())

const prettyFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `${String(timestamp)} ${level}: ${String(message)}${rest}`
  }),
)

export const rootLogger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  defaultMeta: {
    service: 'night-shift-api',
    env: process.env['NODE_ENV'] ?? 'development',
    pid: process.pid,
  },
  format: logPretty && !isProduction ? prettyFormat : jsonFormat,
  transports: [new winston.transports.Console()],
})

export interface RequestLogContext {
  requestId: string
  hotelId?: string
  targetMorning?: string
}

export function createRequestLogger(context: RequestLogContext): winston.Logger {
  return rootLogger.child(context)
}

export function logPhase(
  logger: winston.Logger,
  event: string,
  fields: Record<string, unknown>,
): void {
  logger.info(event, { event, ...fields })
}
