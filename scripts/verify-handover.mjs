import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const eventsFile = JSON.parse(fs.readFileSync(path.join(root, 'data/events.json'), 'utf8'))
const nightLogContent = fs.readFileSync(path.join(root, 'data/night-logs.md'), 'utf8')

const nightSection = nightLogContent.split('---').slice(1).join('---').trim()
const contentStart = nightSection.indexOf('Hi all,')
const nightLogText = contentStart >= 0 ? nightSection.slice(contentStart) : nightSection

const payload = {
  hotel: {
    id: eventsFile.hotel.id,
    name: eventsFile.hotel.name,
    timezone: eventsFile.hotel.timezone,
  },
  events: eventsFile.events,
  nightLogs: [
    {
      nightLabel: 'Wed 27 May → morning Thu 28 May (relief cover — system was down)',
      content: nightLogText,
    },
  ],
  targetMorning: '2026-05-28',
}

const response = await fetch('http://localhost:3001/handover', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

const body = await response.json()

if (!response.ok) {
  console.error('FAILED', response.status, JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log('STATUS', response.status)
console.log('URGENT', body.summary.urgent.map((i) => i.title))
console.log('PENDING', body.summary.pending.map((i) => i.title))
console.log('FYI', body.summary.fyi.map((i) => i.title))
console.log('ISSUE_COUNT', body.issues.length)
console.log(
  'FLAGS',
  body.issues.flatMap((i) => i.flags).filter(Boolean),
)
console.log('META', body.meta.reconciliationNotes)
console.log('ISSUES', body.issues.map((i) => `${i.title} [${i.sourceIds.join(',')}]`))
