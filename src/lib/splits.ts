import type { SplitChoice } from "@/types/session"

export const LAP_M = 250
export const QUARTER_M = LAP_M / 4
export const HALF_M = LAP_M / 2

const SPLIT_STEPS: Record<SplitChoice, number> = {
  quarter: QUARTER_M,
  half: HALF_M,
  full: LAP_M,
}

export function buildSplitDistances(totalMeters: number, choice: SplitChoice): number[] {
  const step = SPLIT_STEPS[choice]
  if (step <= 0 || totalMeters <= 0) {
    return []
  }
  const distances: number[] = []
  for (let distance = step; distance <= totalMeters + 1e-6; distance += step) {
    distances.push(Number(distance.toFixed(3)))
  }
  if (distances.length === 0 || distances.at(-1)! < totalMeters - 1e-6) {
    distances.push(Number(totalMeters.toFixed(3)))
  }
  return Array.from(new Set(distances)).sort((a, b) => a - b)
}
