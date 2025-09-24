import type { MetricsRow } from "@/types/session"
import { distanceToLabel, roundTo } from "@/lib/utils"

export function buildMetrics(distances: number[], marks: Record<string, number | null>): MetricsRow[] {
  const startAbs = marks["Start time"]
  if (startAbs === null || startAbs === undefined) {
    return []
  }

  const uniqueDistances = Array.from(new Set(distances.map((d) => Number(d.toFixed(3))))).filter((d) => d > 0)
  uniqueDistances.sort((a, b) => a - b)

  const points = [
    { distance: 0, label: "Start time", time: startAbs },
    ...uniqueDistances.map((distance) => {
      const label = distanceToLabel(distance)
      return {
        distance,
        label,
        time: marks[label] ?? null,
      }
    }),
  ]

  const rows: MetricsRow[] = []

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    if (current.time === null || next.time === null || next.time === undefined) {
      continue
    }
    const deltaT = next.time - current.time
    const deltaD = next.distance - current.distance
    if (!Number.isFinite(deltaT) || deltaT <= 0 || deltaD <= 0) {
      continue
    }
    const velocityMs = deltaD / deltaT
    const velocityKmh = velocityMs * 3.6
    const previous = rows.at(-1)
    const acceleration = previous
      ? (velocityMs - previous.deltaD / previous.deltaT) / deltaT
      : null

    rows.push({
      from: roundTo(current.distance, 3),
      to: roundTo(next.distance, 3),
      deltaT: roundTo(deltaT, 3),
      deltaD: roundTo(deltaD, 3),
      velocityKmh: roundTo(velocityKmh, 3),
      acceleration: acceleration === null ? null : roundTo(acceleration, 3),
    })
  }

  return rows
}
