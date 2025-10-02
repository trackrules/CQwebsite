import FitParser from "fit-file-parser"

export type FitMetricKey = "speedKmh" | "heartRateBpm" | "cadenceRpm" | "powerWatts" | "distanceMeters"

export type FitSample = {
  timestamp: Date
  offsetSeconds: number
  distanceMeters: number | null
  speedKmh: number | null
  heartRateBpm: number | null
  cadenceRpm: number | null
  powerWatts: number | null
}

export type FitSeries = {
  samples: FitSample[]
  startTimestamp: Date | null
  endTimestamp: Date | null
  availableMetrics: FitMetricKey[]
}

const parserOptions = {
  force: true,
  speedUnit: "km/h" as const,
  lengthUnit: "m" as const,
  temperatureUnit: "celsius" as const,
  elapsedRecordField: true,
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }
  if (typeof value === "number") {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }
  return null
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function computeAvailableMetrics(samples: FitSample[]): FitMetricKey[] {
  const metrics: FitMetricKey[] = []
  const check = (key: FitMetricKey) => {
    if (!metrics.includes(key) && samples.some((sample) => sample[key] !== null && sample[key] !== undefined)) {
      metrics.push(key)
    }
  }

  check("speedKmh")
  check("heartRateBpm")
  check("cadenceRpm")
  check("powerWatts")
  check("distanceMeters")

  return metrics
}

export async function parseFitFile(file: File): Promise<FitSeries> {
  const buffer = await file.arrayBuffer()
  const parser = new FitParser(parserOptions)

  const data = await new Promise<import("fit-file-parser").FitFile>((resolve, reject) => {
    parser.parse(buffer, (error, result) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
        return
      }
      resolve(result)
    })
  })

  const records = Array.isArray(data.records) ? data.records : []
  const samples: FitSample[] = []

  let baseTimestamp: Date | null = null

  for (const record of records) {
    const timestamp = toDate(record.timestamp)
    if (!timestamp) {
      continue
    }
    if (!baseTimestamp) {
      baseTimestamp = timestamp
    }

    const offsetSeconds = baseTimestamp ? (timestamp.getTime() - baseTimestamp.getTime()) / 1000 : 0

    samples.push({
      timestamp,
      offsetSeconds,
      distanceMeters: toNumber((record as { distance?: unknown }).distance ?? null),
      speedKmh: toNumber((record as { speed?: unknown }).speed ?? null),
      heartRateBpm: toNumber((record as { heart_rate?: unknown }).heart_rate ?? null),
      cadenceRpm: toNumber((record as { cadence?: unknown }).cadence ?? null),
      powerWatts: toNumber((record as { power?: unknown }).power ?? null),
    })
  }

  const availableMetrics = computeAvailableMetrics(samples)

  const startTimestamp = samples[0]?.timestamp ?? null
  const endTimestamp = samples.at(-1)?.timestamp ?? null

  return {
    samples,
    startTimestamp,
    endTimestamp,
    availableMetrics,
  }
}
