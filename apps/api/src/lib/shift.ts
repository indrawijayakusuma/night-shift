import { DateTime } from 'luxon'

export interface ShiftInfo {
  shiftEndMorning: string
  shiftLabel: string
}

export function parseTimezoneOffset(timezone: string): string {
  if (timezone.startsWith('+') || timezone.startsWith('-')) {
    return `UTC${timezone}`
  }
  return timezone
}

export function getShiftForTimestamp(timestamp: string, timezone: string): ShiftInfo {
  const zone = parseTimezoneOffset(timezone)
  const local = DateTime.fromISO(timestamp, { setZone: true }).setZone(zone)

  if (!local.isValid) {
    throw new Error(`Invalid timestamp: ${timestamp}`)
  }

  const hour = local.hour
  let shiftEnd: DateTime

  if (hour >= 23) {
    shiftEnd = local.plus({ days: 1 }).startOf('day')
  } else if (hour < 7) {
    shiftEnd = local.startOf('day')
  } else {
    shiftEnd = local.plus({ days: 1 }).startOf('day')
  }

  const shiftEndMorning = shiftEnd.toISODate()
  if (!shiftEndMorning) {
    throw new Error(`Could not compute shift end for ${timestamp}`)
  }

  const shiftStart = shiftEnd.minus({ days: 1 }).set({ hour: 23, minute: 0, second: 0 })
  const shiftLabel = `${shiftStart.toFormat('ccc d MMM')} night → ${shiftEnd.toFormat('ccc d MMM')} morning`

  return { shiftEndMorning, shiftLabel }
}

export function isInTargetShift(timestamp: string, timezone: string, targetMorning: string): boolean {
  const { shiftEndMorning } = getShiftForTimestamp(timestamp, timezone)
  return shiftEndMorning === targetMorning
}

export function isBeforeTargetShift(
  timestamp: string,
  timezone: string,
  targetMorning: string,
): boolean {
  const { shiftEndMorning } = getShiftForTimestamp(timestamp, timezone)
  return shiftEndMorning < targetMorning
}

export function approximateTimestampForNightLog(
  targetMorning: string,
  timezone: string,
  hourHint: number,
  minuteHint = 0,
): string {
  const zone = parseTimezoneOffset(timezone)
  const morning = DateTime.fromISO(targetMorning, { zone }).set({ hour: hourHint, minute: minuteHint })
  const adjusted = hourHint >= 23
    ? morning.minus({ days: 1 }).set({ hour: hourHint, minute: minuteHint })
    : morning

  return adjusted.toISO() ?? `${targetMorning}T${String(hourHint).padStart(2, '0')}:${String(minuteHint).padStart(2, '0')}:00${timezone}`
}
