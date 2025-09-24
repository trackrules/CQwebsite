import { describe, expect, it } from "vitest"

import { buildSplitDistances } from "@/lib/splits"

describe("buildSplitDistances", () => {
  it("builds quarter lap splits", () => {
    expect(buildSplitDistances(250, "quarter")).toEqual([62.5, 125, 187.5, 250])
  })

  it("caps at total distance", () => {
    expect(buildSplitDistances(200, "half")).toEqual([125, 200])
  })

  it("handles zero distance", () => {
    expect(buildSplitDistances(0, "full")).toEqual([])
  })
})
