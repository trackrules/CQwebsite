import type { ChangeEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { CollapsibleSection } from "@/components/annotate/CollapsibleSection"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MetricsPanel } from "@/components/annotate/MetricsPanel"
import { SessionControls } from "@/components/annotate/SessionControls"
import { TimestampGrid, type LabelOption } from "@/components/annotate/TimestampGrid"
import { VideoPlayer, type VideoHandle, type VideoMetadata } from "@/components/annotate/VideoPlayer"
import { VideoSourceDialog } from "@/components/annotate/VideoSourceDialog"
import { PhoneUploadDialog } from "@/components/annotate/PhoneUploadDialog"
import { FitTelemetryOverlay } from "@/components/annotate/FitTelemetryOverlay"
import { parseVideoFilename } from "@/lib/filename"
import { parseFitFile, type FitSeries } from "@/lib/fit"
import { computeVideoKey } from "@/lib/hash"
import { buildSplitDistances } from "@/lib/splits"
import { buildRelativeMarks } from "@/lib/session"
import { distanceToLabel } from "@/lib/utils"
import { getSession } from "@/store/sessions"
import type { Session, SplitChoice, StartType } from "@/types/session"

const DEFAULT_DISTANCE = 250

const BASE_LABELS: LabelOption[] = ["Start time", "Reaction time", "15"]

function ensureMarks(distances: number[], base?: Record<string, number | null>) {
  const result: Record<string, number | null> = {
    "Start time": base?.["Start time"] ?? null,
    "Reaction time": base?.["Reaction time"] ?? null,
    "15": base?.["15"] ?? null,
  }
  const labels = new Set<string>(Object.keys(base ?? {}))
  for (const distance of distances) {
    labels.add(distanceToLabel(distance))
  }
  labels.forEach((label) => {
    if (!(label in result)) {
      result[label] = base?.[label] ?? null
    }
  })
  return result
}

function sanitizeDistances(distances: number[]): number[] {
  const unique = new Set<string>()
  const result: number[] = []
  for (const raw of distances) {
    if (!Number.isFinite(raw)) continue
    if (raw <= 0) continue
    const rounded = Number(raw.toFixed(3))
    const label = distanceToLabel(rounded)
    if (label === "15") {
      continue
    }
    if (unique.has(label)) {
      continue
    }
    unique.add(label)
    result.push(rounded)
  }
  return result.sort((a, b) => a - b)
}

function padTimePart(value: number): string {
  return value.toString().padStart(2, "0")
}

function inferTimeOfDayFromTimestamp(timestamp: number | null | undefined): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return null
  }
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) {
    return null
  }
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`
}

const TIME_OF_DAY_REGEX = /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/

function normalizeTimeOfDay(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const match = TIME_OF_DAY_REGEX.exec(trimmed)
  if (!match) {
    return null
  }
  const hours = Number.parseInt(match[1] ?? "0", 10)
  const minutes = Number.parseInt(match[2] ?? "0", 10)
  const seconds = Number.parseInt(match[3] ?? "0", 10)
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null
  }
  return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}`
}

function combineDateAndTime(dateIso: string | null | undefined, timeOfDay: string | null | undefined): Date | null {
  const normalizedTime = normalizeTimeOfDay(timeOfDay)
  if (!dateIso || !normalizedTime) {
    return null
  }
  const candidate = new Date(`${dateIso}T${normalizedTime}`)
  if (!Number.isFinite(candidate.getTime())) {
    return null
  }
  return candidate
}

function extensionFromMime(mime: string | null): string | null {
  if (!mime) return null
  if (mime.includes("mp4")) return ".mp4"
  if (mime.includes("webm")) return ".webm"
  if (mime.includes("quicktime")) return ".mov"
  if (mime.includes("ogg")) return ".ogv"
  return null
}

function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename\*?=([^;]+)/i)
  if (!match) return null
  let value = match[1]?.trim() ?? ""
  if (!value) return null
  if (value.startsWith("UTF-8''")) {
    value = decodeURIComponent(value.slice(7))
  }
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  return value || null
}

function inferFileName(url: string, disposition: string | null, mime: string | null): string {
  const fromDisposition = fileNameFromDisposition(disposition)
  if (fromDisposition) {
    return fromDisposition
  }
  let candidate: string | null = null
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split("/").filter(Boolean)
    if (segments.length > 0) {
      candidate = segments[segments.length - 1]
    }
  } catch {
    candidate = null
  }
  const extension = extensionFromMime(mime)
  if (candidate && candidate.includes(".")) {
    return candidate
  }
  if (candidate && extension) {
    return `${candidate}${extension}`
  }
  if (candidate) {
    return `${candidate}${extension ?? ".mp4"}`
  }
  return `remote-video${extension ?? ".mp4"}`
}

type AnnotateViewProps = {
  onPersistSession: (session: Session) => Promise<void>
}

type SessionDraft = {
  video?: string
  videoKey?: string
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

const formatLabel = (label: LabelOption) => {
  if (label === "Start time" || label === "Reaction time") {
    return label
  }
  if (label === "15") {
    return "15 m"
  }
  const numeric = Number(label)
  if (Number.isFinite(numeric)) {
    return `${label} m`
  }
  return label
}

export function AnnotateView({ onPersistSession }: AnnotateViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fitInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<VideoHandle | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fitFile, setFitFile] = useState<File | null>(null)
  const [fitSeries, setFitSeries] = useState<FitSeries | null>(null)
  const [fitError, setFitError] = useState<string | null>(null)
  const [fitLoading, setFitLoading] = useState(false)
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false)
  const [isPhoneUploadDialogOpen, setIsPhoneUploadDialogOpen] = useState(false)
  const [phoneUploadSessionId, setPhoneUploadSessionId] = useState<string | null>(null)

  const videoStartDate = useMemo(
    () => combineDateAndTime(draft?.date_iso ?? null, draft?.time_of_day ?? null),
    [draft?.date_iso, draft?.time_of_day],
  )

  const uploadServerUrl = (import.meta.env.VITE_UPLOAD_SERVER_URL ?? "http://localhost:3030").trim()
  const processedPhoneUploads = useRef<Set<string>>(new Set())
  const phoneUploadTimerRef = useRef<number | null>(null)

  const handleOpenSourcePicker = useCallback(() => {
    setIsSourceDialogOpen(true)
  }, [])

  const handleCloseSourceDialog = useCallback(() => {
    setIsSourceDialogOpen(false)
  }, [])

  const handleSelectLocal = useCallback(() => {
    setIsSourceDialogOpen(false)
    inputRef.current?.click()
  }, [])

  const handleOpenFitPicker = useCallback(() => {
    fitInputRef.current?.click()
  }, [])

  const handleFitFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null
      event.target.value = ""
      if (!nextFile) {
        return
      }
      setFitLoading(true)
      setFitError(null)
      try {
        const series = await parseFitFile(nextFile)
        setFitFile(nextFile)
        setFitSeries(series)
        setStatusMessage(`Loaded FIT file "${nextFile.name}" with ${series.samples.length} sample${series.samples.length === 1 ? "" : "s"}.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setFitError(message || "Failed to load FIT file.")
        setFitFile(null)
        setFitSeries(null)
        setStatusMessage(`Failed to load FIT file: ${message}`)
      } finally {
        setFitLoading(false)
      }
    },
    [],
  )

  const handleSelectPhoneUpload = useCallback(() => {
    setIsSourceDialogOpen(false)
    setIsPhoneUploadDialogOpen(true)
  }, [])

  const handlePhoneDialogClose = useCallback(() => {
    setIsPhoneUploadDialogOpen(false)
  }, [])

  const handlePhoneSessionStart = useCallback((sessionId: string) => {
    setPhoneUploadSessionId(sessionId)
    processedPhoneUploads.current.clear()
  }, [])

  const handlePhoneSessionEnd = useCallback(() => {
    setPhoneUploadSessionId(null)
  }, [])

  const loadFile = useCallback(
    async (nextFile: File) => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl)
      }
      const objectUrl = URL.createObjectURL(nextFile)
      setFileUrl(objectUrl)
      setFile(nextFile)
      setVideoMeta(null)
      setCurrentTime(0)
      setStatusMessage(null)
      setFitFile(null)
      setFitSeries(null)
      setFitError(null)
      setFitLoading(false)

      const parsed = parseVideoFilename(nextFile.name)

      let videoKey: string | undefined
      try {
        videoKey = await computeVideoKey(nextFile)
      } catch (error) {
        console.error("Failed to compute video key", error)
      }

      let saved: Session | undefined
      if (videoKey) {
        saved = await getSession(videoKey)
      }

      const splitChoice: SplitChoice = saved?.split_choice ?? "quarter"
      const totalDistanceRaw = saved?.distance_total_m ?? parsed.distance ?? DEFAULT_DISTANCE
      const inferredTime = inferTimeOfDayFromTimestamp(nextFile.lastModified)
      const timeOfDay = normalizeTimeOfDay(saved?.time_of_day ?? parsed.time_of_day ?? inferredTime)
      const distanceTotal = Number.isFinite(totalDistanceRaw) && totalDistanceRaw > 0 ? totalDistanceRaw : DEFAULT_DISTANCE
      const distances = sanitizeDistances(saved?.distances ?? buildSplitDistances(distanceTotal, splitChoice))

      const initialDraft: SessionDraft = {
        video: nextFile.name,
        videoKey,
        athlete: saved?.athlete ?? "",
        split_choice: splitChoice,
        start_type: saved?.start_type ?? parsed.start_type ?? "ST",
        distance_total_m: distanceTotal,
        distances,
        marks_abs: ensureMarks(distances, saved?.marks_abs),
        fps: saved?.fps ?? 30,
        date_iso: saved?.date_iso ?? parsed.date_iso ?? null,
        time_of_day: timeOfDay,
        group: saved?.group ?? parsed.group ?? null,
        riders: saved?.riders ?? parsed.riders ?? [],
        rep: saved?.rep ?? parsed.rep ?? null,
      }

      setDraft(initialDraft)
      videoRef.current?.seekTo(0)
      if (saved) {
        setStatusMessage("Loaded saved session")
      }
    },
    [fileUrl],
  )

  const handleSelectUrl = useCallback(
    async (rawUrl: string) => {
      const trimmed = rawUrl.trim()
      if (!trimmed) {
        const message = "Enter a video URL to continue."
        setStatusMessage(message)
        throw new Error(message)
      }
      setStatusMessage(`Fetching video from ${trimmed}...`)
      let response: Response
      try {
        response = await fetch(trimmed)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const formatted = `Failed to fetch video: ${message}`
        setStatusMessage(formatted)
        throw new Error(formatted)
      }
      if (!response.ok) {
        const formatted = `Failed to fetch video (HTTP ${response.status})`
        setStatusMessage(formatted)
        throw new Error(formatted)
      }
      const blob = await response.blob()
      const contentDisposition = response.headers.get("content-disposition")
      const mime = response.headers.get("content-type") ?? blob.type ?? "video/mp4"
      const fileName = inferFileName(trimmed, contentDisposition, mime)
      if (!mime.startsWith("video/")) {
        setStatusMessage(`Warning: received content-type ${mime}. Attempting to load anyway.`)
      }
      const remoteFile = new File([blob], fileName, { type: mime, lastModified: Date.now() })
      await loadFile(remoteFile)
      setStatusMessage(`Loaded "${fileName}" from URL.`)
      setIsSourceDialogOpen(false)
    },
    [loadFile],
  )

  useEffect(() => {
    if (!phoneUploadSessionId) {
      if (phoneUploadTimerRef.current) {
        window.clearInterval(phoneUploadTimerRef.current)
        phoneUploadTimerRef.current = null
      }
      return
    }

    if (!uploadServerUrl) {
      return
    }

    const baseUrl = uploadServerUrl.replace(/\/$/, "")
    let cancelled = false

    const checkForUploads = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/uploads/${phoneUploadSessionId}`)
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as { uploads?: Array<Record<string, any>> }
        const uploads = Array.isArray(payload.uploads) ? payload.uploads : []
        const nextUpload = uploads.find((item) => item?.id && !processedPhoneUploads.current.has(item.id))
        if (!nextUpload) {
          return
        }
        processedPhoneUploads.current.add(nextUpload.id)

        const mediaResponse = await fetch(`${baseUrl}/uploads/${nextUpload.fileName}`)
        if (!mediaResponse.ok) {
          throw new Error(`Failed to download upload (${mediaResponse.status})`)
        }

        const blob = await mediaResponse.blob()
        if (cancelled) {
          return
        }

        const fileName = nextUpload.originalName || nextUpload.fileName || "phone-upload.mp4"
        const mimeType = nextUpload.mimeType || blob.type || "video/mp4"
        const remoteFile = new File([blob], fileName, { type: mimeType, lastModified: Date.now() })
        await loadFile(remoteFile)
        setStatusMessage(`Received "${fileName}" from phone upload.`)
        setIsPhoneUploadDialogOpen(false)
        setIsSourceDialogOpen(false)
        void fetch(`${baseUrl}/api/uploads/${nextUpload.id}/consume`, { method: "POST" }).catch((error) => {
          console.warn("Failed to mark phone upload as consumed", error)
        })
      } catch (error) {
        if (cancelled) {
          return
        }
        const message = error instanceof Error ? error.message : String(error)
        console.error("Phone upload fetch failed", error)
        setStatusMessage(`Failed to fetch phone upload: ${message}`)
      }
    }

    void checkForUploads()
    phoneUploadTimerRef.current = window.setInterval(() => {
      void checkForUploads()
    }, 4000)

    return () => {
      cancelled = true
      if (phoneUploadTimerRef.current) {
        window.clearInterval(phoneUploadTimerRef.current)
        phoneUploadTimerRef.current = null
      }
    }
  }, [loadFile, phoneUploadSessionId, uploadServerUrl])

  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl)
      }
    }
  }, [fileUrl])

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0]
      if (selected) {
        void loadFile(selected)
      }
      event.target.value = ""
    },
    [loadFile],
  )

  const handleMetadata = useCallback((meta: VideoMetadata) => {
    setVideoMeta(meta)
    setDraft((prev) => (prev ? { ...prev, fps: meta.fps } : prev))
  }, [])

  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const updateDraft = useCallback((updater: (current: SessionDraft) => SessionDraft) => {
    setDraft((prev) => {
      if (!prev) return prev
      return updater(prev)
    })
  }, [])

  const handleUpdateMark = useCallback(
    (label: string, absoluteSeconds: number | null) => {
      updateDraft((prev) => {
        const marks = { ...prev.marks_abs }
        marks[label] = absoluteSeconds
        return { ...prev, marks_abs: marks }
      })
    },
    [updateDraft],
  )

  const handleApplySplits = useCallback(() => {
    if (!draft) return
    updateDraft((prev) => {
      const newDistances = sanitizeDistances(buildSplitDistances(prev.distance_total_m, prev.split_choice))
      const marks = ensureMarks(newDistances, prev.marks_abs)
      return { ...prev, distances: newDistances, marks_abs: marks }
    })
  }, [draft, updateDraft])

  const handleSplitChoiceChange = useCallback(
    (choice: SplitChoice) => {
      updateDraft((prev) => ({ ...prev, split_choice: choice }))
    },
    [updateDraft],
  )

  const handleStartTypeChange = useCallback(
    (value: StartType) => {
      updateDraft((prev) => ({ ...prev, start_type: value }))
    },
    [updateDraft],
  )

  const handleAthleteChange = useCallback(
    (value: string) => {
      updateDraft((prev) => ({ ...prev, athlete: value }))
    },
    [updateDraft],
  )

  const handleDateChange = useCallback(
    (value: string | null) => {
      updateDraft((prev) => ({ ...prev, date_iso: value && value.trim() ? value : null }))
    },
    [updateDraft],
  )

  const handleTimeOfDayChange = useCallback(
    (value: string | null) => {
      updateDraft((prev) => ({ ...prev, time_of_day: normalizeTimeOfDay(value) }))
    },
    [updateDraft],
  )

  const handleGroupChange = useCallback(
    (value: string) => {
      updateDraft((prev) => ({ ...prev, group: value.trim() || null }))
    },
    [updateDraft],
  )

  const handleRidersChange = useCallback(
    (value: string) => {
      const riders = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      updateDraft((prev) => ({ ...prev, riders }))
    },
    [updateDraft],
  )

  const handleRepChange = useCallback(
    (value: number | null) => {
      if (value === null || !Number.isFinite(value) || value <= 0) {
        updateDraft((prev) => ({ ...prev, rep: null }))
        return
      }
      updateDraft((prev) => ({ ...prev, rep: Math.floor(value) }))
    },
    [updateDraft],
  )

  const handleDistanceTotalChange = useCallback(
    (value: number | null) => {
      if (!Number.isFinite(value) || value === null || value <= 0) {
        return
      }
      updateDraft((prev) => ({ ...prev, distance_total_m: value }))
    },
    [updateDraft],
  )

  const handleDistanceChange = useCallback(
    (index: number, value: number | null) => {
      updateDraft((prev) => {
        const nextDistances = [...prev.distances]
        if (value === null || !Number.isFinite(value) || value <= 0) {
          nextDistances.splice(index, 1)
        } else {
          nextDistances[index] = value
        }
        const sanitized = sanitizeDistances(nextDistances)
        const marks = ensureMarks(sanitized, prev.marks_abs)
        return { ...prev, distances: sanitized, marks_abs: marks }
      })
    },
    [updateDraft],
  )

  const handleDistanceRemove = useCallback(
    (index: number) => {
      updateDraft((prev) => {
        const nextDistances = prev.distances.filter((_, idx) => idx !== index)
        const sanitized = sanitizeDistances(nextDistances)
        const marks = ensureMarks(sanitized, prev.marks_abs)
        return { ...prev, distances: sanitized, marks_abs: marks }
      })
    },
    [updateDraft],
  )

  const handleDistanceAdd = useCallback(() => {
    updateDraft((prev) => {
      const current = [...prev.distances]
      const last = current.at(-1) ?? 0
      let candidate = last + 10
      const seen = new Set(current.map((item) => distanceToLabel(item)))
      while (seen.has(distanceToLabel(candidate))) {
        candidate += 5
      }
      current.push(candidate)
      const sanitized = sanitizeDistances(current)
      const marks = ensureMarks(sanitized, prev.marks_abs)
      return { ...prev, distances: sanitized, marks_abs: marks }
    })
  }, [updateDraft])

  const handleSaveSession = useCallback(async () => {
    if (!draft || !draft.videoKey || !draft.video) {
      setStatusMessage("No session data to save yet")
      return
    }
    const session: Session = {
      video: draft.video,
      videoKey: draft.videoKey,
      athlete: draft.athlete,
      split_choice: draft.split_choice,
      start_type: draft.start_type,
      distance_total_m: draft.distance_total_m,
      distances: draft.distances,
      marks_abs: draft.marks_abs,
      fps: draft.fps,
      date_iso: draft.date_iso,
      time_of_day: draft.time_of_day,
      group: draft.group,
      riders: draft.riders,
      rep: draft.rep,
    }
    await onPersistSession(session)
    setStatusMessage("Session saved")
  }, [draft, onPersistSession])

  const timestampLabels = useMemo<LabelOption[]>(() => {
    const distances = draft?.distances ?? []
    const distanceLabels = Array.from(new Set(distances.map((distance) => distanceToLabel(distance)))).sort(
      (a, b) => Number(a) - Number(b),
    )
    return [...BASE_LABELS, ...distanceLabels]
  }, [draft?.distances])

  const nextLabel = useMemo<LabelOption | null>(() => {
    if (!draft) {
      return null
    }
    for (const label of timestampLabels) {
      if (draft.marks_abs[label] === null || draft.marks_abs[label] === undefined) {
        return label
      }
    }
    return null
  }, [draft, timestampLabels])

  const previousLabel = useMemo(() => {
    if (!draft) {
      return null
    }
    let last: { label: LabelOption; value: number } | null = null
    for (const label of timestampLabels) {
      const value = draft.marks_abs[label]
      if (value === null || value === undefined) {
        break
      }
      last = { label, value }
    }
    return last
  }, [draft, timestampLabels])

  const relativeMarks = useMemo(() => buildRelativeMarks(draft?.marks_abs ?? {}), [draft])
  const startSet = useMemo(() => {
    if (!draft) return false
    const startValue = draft.marks_abs["Start time"]
    return startValue !== null && startValue !== undefined
  }, [draft])

  const nextLabelDisplay = nextLabel ? formatLabel(nextLabel) : "All timestamps captured"

  const previousDisplay = useMemo(() => {
    if (!draft || !previousLabel) {
      return "Previous: ?"
    }
    const { label, value } = previousLabel
    if (label === "Start time") {
      return `Previous: ${formatLabel(label)} (${value.toFixed(2)} s)`
    }
    const start = draft.marks_abs["Start time"] ?? 0
    const rel = value - start
    return `Previous: ${formatLabel(label)} (${rel.toFixed(2)} s)`
  }, [draft, previousLabel])

  const handleCaptureNext = useCallback(() => {
    if (!draft) {
      setStatusMessage("Load a video to record timestamps.")
      return
    }
    if (!nextLabel) {
      setStatusMessage("All timestamps captured.")
      return
    }
    const current = videoRef.current?.getCurrentTime()
    if (current === undefined) {
      setStatusMessage("Video time unavailable. Make sure the video is loaded.")
      return
    }
    if (nextLabel === "Start time") {
      handleUpdateMark("Start time", current)
      setStatusMessage(`Start time set at ${current.toFixed(2)} s.`)
      return
    }
    const startAbs = draft.marks_abs["Start time"]
    if (startAbs === null || startAbs === undefined) {
      setStatusMessage("Set the Start time before recording other marks.")
      return
    }
    handleUpdateMark(nextLabel, current)
    const relative = current - startAbs
    setStatusMessage(`${formatLabel(nextLabel)} recorded at ${relative.toFixed(2)} s.`)
  }, [draft, handleUpdateMark, nextLabel])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return
      }
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      event.preventDefault()
      handleCaptureNext()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleCaptureNext])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col text-sm text-muted-foreground">
          <span>{file ? `Video: ${file.name}` : "No video loaded"}</span>
          <span>
            {fitFile
              ? `FIT: ${fitFile.name}${fitSeries ? ` (${fitSeries.samples.length} sample${fitSeries.samples.length === 1 ? "" : "s"})` : ""}`
              : "No FIT data loaded"}
          </span>
          {fitError ? <span className="text-xs text-red-400">{fitError}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={fitInputRef}
            type="file"
            accept=".fit,application/octet-stream,application/fit"
            className="hidden"
            onChange={handleFitFileSelect}
          />
          <Button onClick={handleOpenSourcePicker}>Open Video</Button>
          <Button onClick={handleOpenFitPicker} disabled={fitLoading}>
            {fitLoading ? "Loading FIT..." : "Load FIT data"}
          </Button>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-3">
          <VideoPlayer
            ref={videoRef}
            fileUrl={fileUrl}
            onMetadata={handleMetadata}
            onTimeChange={handleTimeChange}
            overlay={
              fitSeries ? (
                <FitTelemetryOverlay series={fitSeries} videoStart={videoStartDate} currentTime={currentTime} />
              ) : null
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-purple-400/60 bg-purple-600/15 px-4 py-3 text-xs sm:text-sm text-purple-100">
            <span className="font-medium">{previousDisplay}</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">Next: {nextLabelDisplay}</span>
              {draft?.distance_total_m ? (
                <span className="rounded-full border border-purple-300/60 px-2 py-0.5 text-[11px] sm:text-xs">Track: {draft.distance_total_m} m</span>
              ) : null}
              <Button
                onClick={handleCaptureNext}
                disabled={!draft || !nextLabel || !fileUrl}
                className="bg-purple-600 text-white hover:bg-purple-500 focus-visible:ring-purple-300"
              >
                Enter next (Enter)
              </Button>
            </div>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="flex flex-col gap-6 pr-2">
            <SessionControls
              fileName={draft?.video ?? file?.name ?? null}
              fps={videoMeta?.fps ?? draft?.fps ?? null}
              dateIso={draft?.date_iso ?? null}
              onDateChange={handleDateChange}
              timeOfDay={draft?.time_of_day ?? null}
              onTimeOfDayChange={handleTimeOfDayChange}
              group={draft?.group ?? null}
              onGroupChange={handleGroupChange}
              riders={draft?.riders ?? []}
              onRidersChange={handleRidersChange}
              rep={draft?.rep ?? null}
              onRepChange={handleRepChange}
              athlete={draft?.athlete ?? ""}
              onAthleteChange={handleAthleteChange}
              startType={draft?.start_type ?? "ST"}
              onStartTypeChange={handleStartTypeChange}
              distanceTotal={draft?.distance_total_m ?? DEFAULT_DISTANCE}
              onDistanceTotalChange={handleDistanceTotalChange}
              splitChoice={draft?.split_choice ?? "quarter"}
              onSplitChoiceChange={handleSplitChoiceChange}
              onApplySplits={handleApplySplits}
              distances={draft?.distances ?? []}
              onDistanceChange={handleDistanceChange}
              onDistanceRemove={handleDistanceRemove}
              onDistanceAdd={handleDistanceAdd}
              onSaveSession={handleSaveSession}
              statusMessage={statusMessage}
            />
            <CollapsibleSection title="Timestamps" defaultOpen>
              <TimestampGrid
                labelOrder={timestampLabels}
                marksAbs={draft?.marks_abs ?? {}}
                marksRel={relativeMarks}
                currentTime={currentTime}
                onUpdate={handleUpdateMark}
                startSet={startSet}
              />
            </CollapsibleSection>
            <CollapsibleSection title="Segment Metrics" defaultOpen>
              <MetricsPanel
                marks={draft?.marks_abs ?? {}}
                distanceTotal={draft?.distance_total_m ?? DEFAULT_DISTANCE}
                activeChoice={draft?.split_choice ?? "quarter"}
              />
            </CollapsibleSection>
          </div>
        </ScrollArea>
      </div>
      <VideoSourceDialog
        open={isSourceDialogOpen}
        onClose={handleCloseSourceDialog}
        onSelectLocal={handleSelectLocal}
        onSelectUrl={handleSelectUrl}
        onSelectPhoneUpload={handleSelectPhoneUpload}
      />
      <PhoneUploadDialog
        open={isPhoneUploadDialogOpen}
        onClose={handlePhoneDialogClose}
        onSessionStart={handlePhoneSessionStart}
        onSessionEnd={handlePhoneSessionEnd}
        uploadServerUrl={uploadServerUrl}
      />
    </div>
  )
}


