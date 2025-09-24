import type { ChangeEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { CollapsibleSection } from "@/components/annotate/CollapsibleSection"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MetricsPanel } from "@/components/annotate/MetricsPanel"
import { SessionControls } from "@/components/annotate/SessionControls"
import { TimestampGrid, type LabelOption } from "@/components/annotate/TimestampGrid"
import { VideoPlayer, type VideoHandle, type VideoMetadata } from "@/components/annotate/VideoPlayer"
import { GooglePhotosDialog } from "@/components/annotate/GooglePhotosDialog"
import { PhoneUploadDialog } from "@/components/annotate/PhoneUploadDialog"
import { consumePendingGoogleAuth, exchangeCodeForTokens, getStoredGoogleTokens, storeGoogleTokens, type TokenResponse } from "@/lib/google-oauth"
import { parseVideoFilename } from "@/lib/filename"
import { computeVideoKey } from "@/lib/hash"
import { buildSplitDistances } from "@/lib/splits"
import { buildRelativeMarks } from "@/lib/session"
import { distanceToLabel } from "@/lib/utils"
import { getSession } from "@/store/sessions"
import type { ParsedFilename, Session, SplitChoice, StartType } from "@/types/session"

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

type AnnotateViewProps = {
  onPersistSession: (session: Session) => Promise<void>
}

type SessionDraft = {
  video?: string
  videoKey?: string
  athlete: string
  effort_time_s: number
  split_choice: SplitChoice
  start_type: StartType
  distance_total_m: number
  distances: number[]
  marks_abs: Record<string, number | null>
  fps: number
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
  const videoRef = useRef<VideoHandle | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [parsedMetadata, setParsedMetadata] = useState<ParsedFilename | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [googleTokens, setGoogleTokens] = useState<TokenResponse | null>(null)
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false)
  const [isPhoneUploadDialogOpen, setIsPhoneUploadDialogOpen] = useState(false)
  const [phoneUploadSessionId, setPhoneUploadSessionId] = useState<string | null>(null)

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

      const parsed = parseVideoFilename(nextFile.name)
      setParsedMetadata(parsed)

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
      const totalDistance = saved?.distance_total_m ?? parsed.distance ?? DEFAULT_DISTANCE
      const distances = saved?.distances ?? buildSplitDistances(totalDistance, splitChoice)

      const initialDraft: SessionDraft = {
        video: nextFile.name,
        videoKey,
        athlete: saved?.athlete ?? "",
        effort_time_s: saved?.effort_time_s ?? 0,
        split_choice: splitChoice,
        start_type: saved?.start_type ?? parsed.start_type ?? "ST",
        distance_total_m: totalDistance,
        distances,
        marks_abs: ensureMarks(distances, saved?.marks_abs),
        fps: saved?.fps ?? 30,
      }

      setDraft(initialDraft)
      videoRef.current?.seekTo(0)
      if (saved) {
        setStatusMessage("Loaded saved session")
      }
    },
    [fileUrl],
  )

  useEffect(() => {
    const stored = getStoredGoogleTokens()
    if (stored) {
      setGoogleTokens(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    let cancelled = false
    const url = new URL(window.location.href)
    const code = url.searchParams.get("code")
    const error = url.searchParams.get("error")
    const stateParam = url.searchParams.get("state")
    if (!code && !error) {
      return
    }

    const finalize = async () => {
      if (code) {
        const pending = consumePendingGoogleAuth()
        if (!pending) {
          setStatusMessage("Google Photos authorization could not be completed. Please start the sign-in again.")
        } else if (pending.state && !stateParam) {
          setStatusMessage("Google Photos authorization failed: state parameter missing. Please retry.")
        } else if (pending.state && stateParam && pending.state !== stateParam) {
          setStatusMessage("Google Photos authorization failed: state mismatch. Please retry.")
        } else {
          setStatusMessage("Completing Google Photos authorization…")
          try {
            const tokens = await exchangeCodeForTokens(code, pending.codeVerifier)
            if (!cancelled) {
              storeGoogleTokens(tokens)
              setGoogleTokens(tokens)
              setStatusMessage("Google Photos authorization completed. Select a video to import.")
            }
          } catch (error) {
            if (!cancelled) {
              const message = error instanceof Error ? error.message : String(error)
              setStatusMessage("Failed to exchange Google Photos code: " + message)
            }
          }
        }
      } else if (error) {
        const message = (() => {
          try {
            return decodeURIComponent(error)
          } catch {
            return error
          }
        })()
        setStatusMessage("Google Photos authorization failed: " + message)
        consumePendingGoogleAuth()
      }

      if (cancelled) {
        return
      }

      const paramsToStrip = ["code", "scope", "authuser", "prompt", "error", "state"]
      let didStrip = false
      for (const param of paramsToStrip) {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param)
          didStrip = true
        }
      }

      if (didStrip) {
        const cleanedSearch = url.searchParams.toString()
        const nextUrl = `${url.pathname}${cleanedSearch ? `?${cleanedSearch}` : ""}${url.hash}`
        window.history.replaceState({}, "", nextUrl)
      }
    }

    void finalize()

    return () => {
      cancelled = true
    }
  }, [])

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
      const newDistances = buildSplitDistances(prev.distance_total_m, prev.split_choice)
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

  const handleEffortChange = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return
      updateDraft((prev) => ({ ...prev, effort_time_s: value }))
    },
    [updateDraft],
  )

  const handleSaveSession = useCallback(async () => {
    if (!draft || !draft.videoKey || !draft.video) {
      setStatusMessage("No session data to save yet")
      return
    }
    const session: Session = {
      video: draft.video,
      videoKey: draft.videoKey,
      athlete: draft.athlete,
      effort_time_s: draft.effort_time_s,
      split_choice: draft.split_choice,
      start_type: draft.start_type,
      distance_total_m: draft.distance_total_m,
      distances: draft.distances,
      marks_abs: draft.marks_abs,
      fps: draft.fps,
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

  const relativeMarks = useMemo(() => buildRelativeMarks(draft?.marks_abs ?? {}), [draft])
  const startSet = useMemo(() => {
    if (!draft) return false
    const startValue = draft.marks_abs["Start time"]
    return startValue !== null && startValue !== undefined
  }, [draft])

  const nextLabelDisplay = nextLabel ? formatLabel(nextLabel) : "All timestamps captured"

  const previousDisplay = useMemo(() => {
    if (!draft || !previousLabel) {
      return "Previous: —"
    }
    const { label, value } = previousLabel
    if (label === "Start time") {
      return `Previous: ${formatLabel(label)} (${value.toFixed(2)} s)`
    }
    const start = draft.marks_abs["Start time"] ?? 0
    const rel = value - start
    return `Previous: ${formatLabel(label)} (${rel.toFixed(2)} s)`
  }, [draft, previousLabel])

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{file ? `${file.name}` : "No video loaded"}</div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={handleOpenSourcePicker}>Open Video</Button>
          {googleTokens && <span className="text-xs text-purple-200">Google Photos connected</span>}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-3">
          <VideoPlayer ref={videoRef} fileUrl={fileUrl} onMetadata={handleMetadata} onTimeChange={handleTimeChange} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-purple-400/60 bg-purple-600/15 px-4 py-3 text-xs sm:text-sm text-purple-100">
            <span className="font-medium">{previousDisplay}</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">Next: {nextLabelDisplay}</span>
              {draft?.distance_total_m ? (
                <span className="rounded-full border border-purple-300/60 px-2 py-0.5 text-[11px] sm:text-xs">Track: {draft.distance_total_m} m</span>
              ) : null}
              <Button
                onClick={handleCaptureNext}
                disabled={!draft || !nextLabel || !file}
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
              parsed={parsedMetadata}
              athlete={draft?.athlete ?? ""}
              onAthleteChange={handleAthleteChange}
              effort={draft?.effort_time_s ?? 0}
              onEffortChange={handleEffortChange}
              startType={draft?.start_type ?? "ST"}
              onStartTypeChange={handleStartTypeChange}
              splitChoice={draft?.split_choice ?? "quarter"}
              onSplitChoiceChange={handleSplitChoiceChange}
              onApplySplits={handleApplySplits}
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
      <GooglePhotosDialog
        open={isSourceDialogOpen}
        onClose={handleCloseSourceDialog}
        onSelectLocal={handleSelectLocal}
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
