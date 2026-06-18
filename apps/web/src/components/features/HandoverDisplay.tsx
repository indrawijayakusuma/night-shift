import type { HandoverResponse, SummaryItem, HandoverIssue } from '@night-shift/shared'
import { AlertTriangle, Info } from 'lucide-react'

interface HandoverDisplayProps {
  handover: HandoverResponse
}

function FlagBadges({ flags }: { flags: string[] }): React.ReactElement | null {
  if (flags.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {flags.map((flag) => (
        <span
          key={flag}
          className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
        >
          <AlertTriangle className="h-3 w-3" />
          {flag}
        </span>
      ))}
    </div>
  )
}

function SummarySection({
  title,
  items,
  accent,
}: {
  title: string
  items: SummaryItem[]
  accent: string
}): React.ReactElement | null {
  if (items.length === 0) return null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className={`text-sm font-semibold uppercase tracking-wide ${accent}`}>{title}</h3>
      <ul className="mt-3 space-y-4">
        {items.map((item) => (
          <li key={`${item.title}-${item.sourceIds.join('-')}`} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.action}</p>
            <p className="mt-2 text-xs text-slate-400">Sources: {item.sourceIds.join(', ')}</p>
            <FlagBadges flags={item.flags} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function IssueRow({ issue }: { issue: HandoverIssue }): React.ReactElement {
  const categoryLabel = {
    still_open: 'Still open',
    newly_resolved: 'Newly resolved',
    new_tonight: 'New tonight',
  }[issue.category]

  const priorityColor = {
    urgent: 'text-red-700 bg-red-50',
    pending: 'text-amber-700 bg-amber-50',
    fyi: 'text-slate-600 bg-slate-100',
  }[issue.priority]

  return (
    <div className="rounded-md border border-slate-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityColor}`}>
          {issue.priority}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {categoryLabel}
        </span>
      </div>
      <p className="mt-2 font-medium text-slate-900">{issue.title}</p>
      <p className="mt-1 text-sm text-slate-600">{issue.action}</p>
      <p className="mt-2 text-xs text-slate-400">Sources: {issue.sourceIds.join(', ')}</p>
      <FlagBadges flags={issue.flags} />
    </div>
  )
}

export function HandoverDisplay({ handover }: HandoverDisplayProps): React.ReactElement {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{handover.hotel.name}</h2>
            <p className="text-sm text-slate-500">
              Handover for {handover.targetMorning} morning · generated{' '}
              {new Date(handover.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {handover.meta.reconciliationNotes.length > 0 && (
          <div className="mt-4 flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="list-inside list-disc space-y-1">
              {handover.meta.reconciliationNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          {handover.meta.eventCount} structured events · {handover.meta.nightLogCount} night log(s)
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-1">
        <SummarySection title="Urgent — act first" items={handover.summary.urgent} accent="text-red-700" />
        <SummarySection title="Pending — follow up" items={handover.summary.pending} accent="text-amber-700" />
        <SummarySection title="FYI — resolved or awareness" items={handover.summary.fyi} accent="text-slate-600" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          All issues ({handover.issues.length})
        </h3>
        <div className="mt-4 space-y-3">
          {handover.issues.map((issue) => (
            <IssueRow key={`${issue.title}-${issue.sourceIds.join('-')}`} issue={issue} />
          ))}
        </div>
      </section>
    </div>
  )
}
