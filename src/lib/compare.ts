import type { Granularity, Session } from "@/types/session"
import { buildSplitDistances } from "@/lib/splits"
import { buildDistanceSeries, buildSplitSeries, getStartTime } from "@/lib/session"
import { distanceToLabel, roundTo } from "@/lib/utils"

export type TableRow = {
  distance: number
  label: string
  values: Record<string, number | null>
}

export function buildTotalTimeRows(sessions: Session[]): TableRow[] {
  const distances = new Set<number>([0])
  for (const session of sessions) {
    for (const distance of session.distances) {
      distances.add(roundTo(distance, 3))
    }
    if (session.marks_abs["15"] !== undefined) {
      distances.add(15)
    }
  }
  const sorted = Array.from(distances).sort((a, b) => a - b)

  return sorted.map((distance) => {
    const label = distance === 0 ? "Start" : distanceToLabel(distance)
    const values: Record<string, number | null> = {}
    for (const session of sessions) {
      const start = getStartTime(session.marks_abs)
      if (start === null) {
        values[session.videoKey] = null
        continue
      }
      if (distance === 0) {
        values[session.videoKey] = 0
        continue
      }
      if (distance === 15 && session.marks_abs["15"] != null) {
        values[session.videoKey] = roundTo(session.marks_abs["15"]! - start, 3)
        continue
      }
      const key = distanceToLabel(distance)
      const absolute = session.marks_abs[key]
      values[session.videoKey] = absolute == null ? null : roundTo(absolute - start, 3)
    }
    return { distance, label, values }
  })
}

export function buildSplitTimeRows(sessions: Session[], granularity: Granularity): TableRow[] {
  const distances = buildSplitDistances(maxDistance(sessions), granularity)
  const rows: TableRow[] = []
  for (const distance of distances) {
    const previous = rows.at(-1)?.distance ?? 0
    const label = distanceToLabel(distance)
    const values: Record<string, number | null> = {}
    for (const session of sessions) {
      const start = getStartTime(session.marks_abs)
      if (start === null) {
        values[session.videoKey] = null
        continue
      }
      const currentKey = distanceToLabel(distance)
      const previousKey = previous === 0 ? "Start time" : distanceToLabel(previous)
      const currentValue = session.marks_abs[currentKey]
      const previousValue = previous === 0 ? start : session.marks_abs[previousKey]
      if (currentValue == null || previousValue == null) {
        values[session.videoKey] = null
        continue
      }
      values[session.videoKey] = roundTo(currentValue - previousValue, 3)
    }
    rows.push({ distance, label, values })
  }
  return rows
}

export function annotateDiffs(rows: TableRow[], referenceKey: string | null): Array<TableRow & { deltas: Record<string, number | null> }> {
  return rows.map((row) => {
    const deltas: Record<string, number | null> = {}
    const referenceValue = referenceKey ? row.values[referenceKey] ?? null : null
    for (const [key, value] of Object.entries(row.values)) {
      if (referenceValue === null || value === null || key === referenceKey) {
        deltas[key] = null
      } else {
        deltas[key] = roundTo(value - referenceValue, 3)
      }
    }
    return { ...row, deltas }
  })
}

export function buildSeriesForChart(session: Session): Array<{ distance: number; time: number }> {
  return buildDistanceSeries(session)
}

export function buildSeriesForGranularity(session: Session, granularity: Granularity) {
  return buildSplitSeries(session, granularity)
}

function maxDistance(sessions: Session[]): number {
  return sessions.reduce((max, session) => Math.max(max, session.distance_total_m ?? 0), 0)
}
