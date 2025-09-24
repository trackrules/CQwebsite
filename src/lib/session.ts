import type { Granularity, Session, SplitChoice } from "@/types/session"
import { buildSplitDistances } from "@/lib/splits"
import { distanceToLabel, roundTo } from "@/lib/utils"

export function getStartTime(marks: Record<string, number | null>): number | null {
  const start = marks["Start time"]
  return start ?? null
}

export function buildRelativeMarks(marks: Record<string, number | null>): Record<string, number | null> {
  const start = getStartTime(marks)
  if (start === null) {
    return Object.fromEntries(Object.entries(marks).map(([key]) => [key, null]))
  }
  return Object.fromEntries(
    Object.entries(marks).map(([key, value]) => [key, value === null ? null : value - start]),
  )
}

export function buildDistanceSeries(session: Session): Array<{ distance: number; time: number }> {
  const start = getStartTime(session.marks_abs)
  if (start === null) {
    return []
  }
  const entries = session.distances
    .map((distance) => {
      const label = distanceToLabel(distance)
      const value = session.marks_abs[label]
      if (value === null || value === undefined) {
        return null
      }
      return { distance, time: roundTo(value - start, 3) }
    })
    .filter((item): item is { distance: number; time: number } => Boolean(item))

  return entries
}

export function buildSplitSeries(session: Session, choice: Granularity): Array<{ distance: number; time: number }> {
  const distances = buildSplitDistances(session.distance_total_m, choice)
  const start = getStartTime(session.marks_abs)
  if (start === null) {
    return []
  }
  const list = distances
    .map((distance) => {
      const label = distanceToLabel(distance)
      const value = session.marks_abs[label]
      if (value === null || value === undefined) {
        return null
      }
      return { distance, time: roundTo(value - start, 3) }
    })
    .filter((item): item is { distance: number; time: number } => Boolean(item))

  return list
}

export function ensureDistances(session: Session, choice: SplitChoice): number[] {
  const distances = buildSplitDistances(session.distance_total_m, choice)
  return [...new Set(distances.map((d) => Number(d.toFixed(3))))]
}
