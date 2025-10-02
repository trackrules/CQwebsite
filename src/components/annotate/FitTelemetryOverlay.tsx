import { useMemo } from "react"

import type { FitSeries, FitSample, FitMetricKey } from "@/lib/fit"
import { formatSeconds } from "@/lib/utils"

export type FitTelemetryOverlayProps = {
  series: FitSeries
  videoStart: Date | null
  currentTime: number
}

type AlignedSample = FitSample & { videoOffsetSeconds: number }

type AlignmentContext = {
  samples: AlignedSample[]
  fitStartTimestamp: Date | null
  rangeStart: number | null
  rangeEnd: number | null
}

const METRIC_LABELS: Record<FitMetricKey, string> = {
  distanceMeters: "Distance",
  speedKmh: "Speed",
  heartRateBpm: "Heart rate",
  cadenceRpm: "Cadence",
  powerWatts: "Power",
}

const METRIC_ORDER: FitMetricKey[] = [
  "speedKmh",
  "powerWatts",
  "heartRateBpm",
  "cadenceRpm",
  "distanceMeters",
]

function formatClock(date: Date | null): string {
  if (!date) {
    return "--:--:--"
  }
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  return `${hours}:${minutes}:${seconds}`
}

function formatMetricValue(key: FitMetricKey, value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--"
  }
  switch (key) {
    case "speedKmh":
      return `${value.toFixed(1)} km/h`
    case "powerWatts":
      return `${Math.round(value)} W`
    case "heartRateBpm":
      return `${Math.round(value)} bpm`
    case "cadenceRpm":
      return `${Math.round(value)} rpm`
    case "distanceMeters":
      return `${(value / 1000).toFixed(3)} km`
    default:
      return value.toString()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function alignSamples(series: FitSeries, videoStart: Date): AlignmentContext {
  const base = videoStart.getTime()
  const samples: AlignedSample[] = series.samples
    .map((sample) => ({
      ...sample,
      videoOffsetSeconds: (sample.timestamp.getTime() - base) / 1000,
    }))
    .filter((sample) => Number.isFinite(sample.videoOffsetSeconds))
    .sort((a, b) => a.videoOffsetSeconds - b.videoOffsetSeconds)

  const firstSample = samples[0] ?? null
  const lastSample = samples.length > 0 ? samples[samples.length - 1] : null
  const fitStartTimestamp = series.startTimestamp ?? firstSample?.timestamp ?? null

  return {
    samples,
    fitStartTimestamp,
    rangeStart: firstSample?.videoOffsetSeconds ?? null,
    rangeEnd: lastSample?.videoOffsetSeconds ?? null,
  }
}

function findNearestSample(samples: AlignedSample[], targetSeconds: number): AlignedSample | null {
  if (samples.length === 0) {
    return null
  }
  let low = 0
  let high = samples.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = samples[mid].videoOffsetSeconds
    if (value === targetSeconds) {
      return samples[mid]
    }
    if (value < targetSeconds) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  const candidates: AlignedSample[] = []
  if (low < samples.length) {
    candidates.push(samples[low])
  }
  if (high >= 0) {
    candidates.push(samples[high])
  }
  if (candidates.length === 0) {
    return null
  }
  return candidates.reduce((best, sample) =>
    Math.abs(sample.videoOffsetSeconds - targetSeconds) <
    Math.abs(best.videoOffsetSeconds - targetSeconds)
      ? sample
      : best,
  candidates[0])
}

export function FitTelemetryOverlay({ series, videoStart, currentTime }: FitTelemetryOverlayProps) {
  const alignment = useMemo(() => {
    if (!videoStart) {
      return null
    }
    return alignSamples(series, videoStart)
  }, [series, videoStart])

  const currentSample = useMemo(() => {
    if (!alignment?.samples.length) {
      return null
    }
    return findNearestSample(alignment.samples, currentTime)
  }, [alignment, currentTime])

  const deltaSeconds = currentSample ? currentSample.videoOffsetSeconds - currentTime : null

  const progress = useMemo(() => {
    if (!alignment || !currentSample) {
      return null
    }
    const { rangeStart, rangeEnd } = alignment
    if (
      rangeStart === null ||
      rangeEnd === null ||
      rangeEnd <= rangeStart ||
      !Number.isFinite(rangeStart) ||
      !Number.isFinite(rangeEnd)
    ) {
      return null
    }
    return clamp((currentSample.videoOffsetSeconds - rangeStart) / (rangeEnd - rangeStart), 0, 1)
  }, [alignment, currentSample])

  const outOfRange = useMemo(() => {
    if (!alignment) {
      return false
    }
    const { rangeStart, rangeEnd } = alignment
    if (rangeStart === null || rangeEnd === null) {
      return false
    }
    return currentTime < rangeStart || currentTime > rangeEnd
  }, [alignment, currentTime])

  const startOffsetSeconds = useMemo(() => {
    if (!alignment || !videoStart || !alignment.fitStartTimestamp) {
      return null
    }
    return (alignment.fitStartTimestamp.getTime() - videoStart.getTime()) / 1000
  }, [alignment, videoStart])

  const metrics = useMemo(() => {
    if (!currentSample) {
      return [] as Array<{ key: FitMetricKey; label: string; value: string }>
    }
    const available = new Set<FitMetricKey>(series.availableMetrics)
    return METRIC_ORDER.filter((key) => available.has(key)).map((key) => ({
      key,
      label: METRIC_LABELS[key],
      value: formatMetricValue(key, currentSample[key]),
    }))
  }, [currentSample, series.availableMetrics])

  return (
    <div className="pointer-events-none flex h-full w-full items-start justify-end p-3 sm:p-4">
      <div className="pointer-events-auto w-60 max-w-full rounded-lg bg-black/70 p-3 text-xs text-purple-100 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-purple-200/80">
          <span>FIT telemetry</span>
          <span className="font-mono text-purple-100">{formatSeconds(currentTime, 2)}</span>
        </div>
        {!videoStart ? (
          <p className="mt-2 text-[11px] text-purple-200/80">
            Set the session date and video start time to align FIT data with the video.
          </p>
        ) : !alignment || alignment.samples.length === 0 ? (
          <p className="mt-2 text-[11px] text-purple-200/80">No timestamped records found in the FIT file.</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-purple-100/90">
              <span className="text-purple-200/70">Video t</span>
              <span className="font-mono">{formatSeconds(currentTime, 2)}</span>
              <span className="text-purple-200/70">FIT time</span>
              <span className="font-mono">{formatClock(currentSample?.timestamp ?? alignment.samples[0]?.timestamp ?? null)}</span>
              <span className="text-purple-200/70">Δ</span>
              <span className={`font-mono ${deltaSeconds !== null && Math.abs(deltaSeconds) > 0.5 ? "text-red-300" : "text-purple-100"}`}>
                {deltaSeconds === null ? "--.--" : formatSeconds(deltaSeconds, 2)}
              </span>
              <span className="text-purple-200/70">FIT start</span>
              <span className="font-mono">{formatClock(alignment.fitStartTimestamp)}</span>
              <span className="text-purple-200/70">Start offset</span>
              <span className="font-mono">{startOffsetSeconds === null ? "--.--" : formatSeconds(startOffsetSeconds, 2)}</span>
            </div>
            {progress !== null ? (
              <div className="mt-3">
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-purple-50/20">
                  <div className="h-full rounded-full bg-purple-400" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-purple-200/70">
                  <span>{formatSeconds(alignment.rangeStart ?? null, 1)}</span>
                  <span>{formatSeconds(alignment.rangeEnd ?? null, 1)}</span>
                </div>
              </div>
            ) : null}
            {outOfRange ? (
              <div className="mt-2 rounded-md border border-yellow-400/60 bg-yellow-500/10 p-2 text-[11px] text-yellow-100">
                Video time sits outside the FIT recording window. Showing the closest available sample.
              </div>
            ) : null}
            {metrics.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {metrics.map((metric) => (
                  <div key={metric.key}>
                    <div className="text-[11px] uppercase tracking-wide text-purple-200/70">{metric.label}</div>
                    <div className="font-mono text-sm">{metric.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-purple-200/80">Current sample has no telemetry values.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
