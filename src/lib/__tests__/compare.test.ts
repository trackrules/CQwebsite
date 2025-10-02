import { describe, expect, it } from "vitest"

import { annotateDiffs, buildSplitTimeRows, buildTotalTimeRows } from "@/lib/compare"
import type { Session } from "@/types/session"

const sessionA: Session = {
  video: "250721-SPDev-Kaio-ST-250-1.mp4",
  videoKey: "keyA",
  athlete: "Kaio",
  split_choice: "quarter",
  start_type: "ST",
  distance_total_m: 250,
  distances: [62.5, 125, 187.5, 250],
  marks_abs: {
    "Start time": 5,
    "62.5": 8,
    "125": 11.5,
    "187.5": 15,
    "250": 19.2,
  },
  fps: 60,
  date_iso: null,
  time_of_day: null,
  group: null,
  riders: [],
  rep: null,
}

const sessionB: Session = {
  ...sessionA,
  video: "250722-SPDev-Mateo-ST-250-1.mp4",
  videoKey: "keyB",
  athlete: "Mateo",
  marks_abs: {
    "Start time": 6,
    "62.5": 9.5,
    "125": 13,
    "187.5": 16.8,
    "250": 21,
  },
}

describe("compare helpers", () => {
  it("builds total time rows", () => {
    const rows = buildTotalTimeRows([sessionA, sessionB])
    const startRow = rows.find((row) => row.distance === 0)!
    expect(startRow.values.keyA).toBe(0)
    expect(startRow.values.keyB).toBe(0)
    const lastRow = rows.find((row) => row.distance === 250)!
    expect(lastRow.values.keyA).toBeCloseTo(14.2, 2)
    expect(lastRow.values.keyB).toBeCloseTo(15, 2)
  })

  it("builds split table rows", () => {
    const rows = buildSplitTimeRows([sessionA, sessionB], "quarter")
    expect(rows).toHaveLength(4)
    expect(rows[0].values.keyA).toBeCloseTo(3, 2)
    expect(rows[0].values.keyB).toBeCloseTo(3.5, 2)
  })

  it("annotates deltas", () => {
    const base = buildTotalTimeRows([sessionA, sessionB])
    const withDiffs = annotateDiffs(base, "keyA")
    const finalRow = withDiffs.find((row) => row.distance === 250)!
    expect(finalRow.deltas.keyB).toBeCloseTo(0.8, 2)
    expect(finalRow.deltas.keyA).toBeNull()
  })
})
