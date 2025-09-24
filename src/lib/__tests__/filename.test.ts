import { describe, expect, it } from "vitest"

import { parseVideoFilename } from "@/lib/filename"

describe("parseVideoFilename", () => {
  it("parses full metadata", () => {
    const result = parseVideoFilename("250721-SPDev-Kaio+Mateo-ST-250-1.mp4")
    expect(result).toEqual({
      date_iso: "2025-07-21",
      group: "SPDev",
      riders: ["Kaio", "Mateo"],
      start_type: "ST",
      distance: 250,
      rep: 1,
    })
  })

  it("handles missing pattern gracefully", () => {
    const result = parseVideoFilename("randomfile.mp4")
    expect(result).toEqual({
      date_iso: null,
      group: null,
      riders: [],
      start_type: null,
      distance: null,
      rep: null,
    })
  })

  it("normalises start type", () => {
    const result = parseVideoFilename("240101-Elite-Jane_FT-Other-125-3.mov")
    expect(result.start_type).toBe("Other")
  })
})
