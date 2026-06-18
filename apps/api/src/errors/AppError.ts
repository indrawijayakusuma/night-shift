export class AppError extends Error {
  readonly statusCode: number
  readonly isOperational: boolean
  readonly code: string
  readonly phase?: string

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    phase?: string,
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.phase = phase
    Object.setPrototypeOf(this, AppError.prototype)
  }
}
