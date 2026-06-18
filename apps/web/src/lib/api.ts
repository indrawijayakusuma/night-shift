import type { HandoverRequest, HandoverResponse } from '@night-shift/shared'

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] || '/api'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function generateHandover(request: HandoverRequest): Promise<HandoverResponse> {
  const response = await fetch(`${API_BASE}/handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string }
    }
    throw new ApiError(
      body.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      body.error?.code,
    )
  }

  return response.json() as Promise<HandoverResponse>
}
