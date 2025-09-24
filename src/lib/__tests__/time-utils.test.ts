import { describe, expect, it } from "vitest"

import { formatSeconds, parseTimeInput } from "@/lib/utils"

describe("parseTimeInput", () => {
  it("parses seconds", () => {
    expect(parseTimeInput("12.5")).toBeCloseTo(12.5)
  })

  it("parses minutes and seconds", () => {
    expect(parseTimeInput("1:05.20")).toBeCloseTo(65.2)
  })

  it("parses signed values", () => {
    expect(parseTimeInput("-0:02.5")).toBeCloseTo(-2.5)
  })

  it("returns null for invalid input", () => {
    expect(parseTimeInput("abc")).toBeNull()
  })
})

describe("formatSeconds", () => {
  it("formats short durations", () => {
    expect(formatSeconds(9.345, 2)).toBe("09.35")
  })

  it("formats long durations", () => {
    expect(formatSeconds(75.2, 2)).toBe("1:15.20")
  })

  it("handles null values", () => {
    expect(formatSeconds(null)).toBe("--.--")
  })
})
