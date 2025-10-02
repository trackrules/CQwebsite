export type SplitChoice = "quarter" | "half" | "full"
export type StartType = "ST" | "FT" | "Other"

export type Session = {
  video: string
  videoKey: string
  athlete: string
  split_choice: SplitChoice
  start_type: StartType
  distance_total_m: number
  distances: number[]
  marks_abs: Record<string, number | null>
  fps: number
  date_iso: string | null
  time_of_day: string | null
  group: string | null
  riders: string[]
  rep: number | null
}

export type SessionMetadata = {
  fileName: string
  fileSize: number
  lastModified: number
  duration: number
}

export type ParsedFilename = {
  date_iso: string | null
  time_of_day: string | null
  group: string | null
  riders: string[]
  start_type: StartType | null
  distance: number | null
  rep: number | null
}

export type ComparisonMode = "total" | "split"

export type Granularity = SplitChoice

export type MetricsRow = {
  from: number
  to: number
  deltaT: number
  deltaD: number
  velocityKmh: number
  acceleration: number | null
}
