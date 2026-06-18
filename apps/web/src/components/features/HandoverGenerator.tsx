'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { HandoverResponse } from '@night-shift/shared'
import { generateHandover } from '@/lib/api'
import { buildSampleRequest, TARGET_MORNING_OPTIONS } from '@/lib/sampleData'
import { HandoverDisplay } from './HandoverDisplay'

export function HandoverGenerator(): React.ReactElement {
  const [targetMorning, setTargetMorning] = useState('2026-05-28')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handover, setHandover] = useState<HandoverResponse | null>(null)

  async function handleGenerate(): Promise<void> {
    setLoading(true)
    setError(null)

    try {
      const request = buildSampleRequest(targetMorning)
      const result = await generateHandover(request)
      setHandover(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate handover')
      setHandover(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Generate handover</h2>
        <p className="mt-1 text-sm text-slate-500">
          Uses bundled sample events from <code className="text-xs">data/events.json</code>
          {targetMorning === '2026-05-28' && ' plus the Wed 27 May relief night log'}.
        </p>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Target morning (7am handover)</span>
            <select
              value={targetMorning}
              onChange={(e) => setTargetMorning(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {TARGET_MORNING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Generating…' : 'Generate handover'}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      {handover && <HandoverDisplay handover={handover} />}
    </div>
  )
}
