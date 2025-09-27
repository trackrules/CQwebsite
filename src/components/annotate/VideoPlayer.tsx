import type { ChangeEvent } from "react"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"

import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn, formatSeconds } from "@/lib/utils"

const DEFAULT_FPS = 30
const TIME_EPSILON = 1e-4
const POLL_INTERVAL_MS = 50

export type VideoHandle = {
  seekTo: (time: number) => void
  stepFrames: (delta: number) => void
  getCurrentTime: () => number
  pause: () => void
}

export type VideoMetadata = {
  duration: number
  fps: number
  frameCount: number
}

type Props = {
  fileUrl: string | null
  autoPlay?: boolean
  onMetadata?: (meta: VideoMetadata) => void
  onTimeChange?: (time: number, frameIndex: number) => void
  className?: string
}

type FrameCallback = number

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getIntrinsicDuration = (video: HTMLVideoElement): number => {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration
  }
  if (video.seekable.length > 0) {
    return video.seekable.end(video.seekable.length - 1)
  }
  return 0
}

export const VideoPlayer = forwardRef<VideoHandle, Props>(
  ({ fileUrl, autoPlay = false, onMetadata, onTimeChange, className }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const fpsRef = useRef(DEFAULT_FPS)
    const durationRef = useRef(0)
    const frameCallbackRef = useRef<FrameCallback | null>(null)
    const lastTimeRef = useRef(-1)
    const lastFrameRef = useRef(-1)
    const wasPlayingRef = useRef(false)

    const [duration, setDuration] = useState(0)
    const [currentTime, setCurrentTime] = useState(0)
    const [frameIndex, setFrameIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)

    const computeFrameIndex = useCallback((time: number, fpsValue: number) => {
      const effectiveFps = fpsValue > 0 ? fpsValue : DEFAULT_FPS
      return Math.max(0, Math.round(time * effectiveFps))
    }, [])

    const emitTime = useCallback(
      (time: number, index: number) => {
        lastTimeRef.current = time
        lastFrameRef.current = index
        setCurrentTime(time)
        setFrameIndex(index)
        onTimeChange?.(time, index)
        if (typeof window !== "undefined") {
          ;(window as any).__annotateCurrentTime = time
          window.dispatchEvent(new CustomEvent("annotate:time", { detail: { time, frameIndex: index } }))
        }
      },
      [onTimeChange],
    )

    const updateFromVideo = useCallback(() => {
      const video = videoRef.current
      if (!video) {
        return
      }

      const durationValue = getIntrinsicDuration(video)
      if (durationValue > 0 && Math.abs(durationValue - durationRef.current) > TIME_EPSILON) {
        durationRef.current = durationValue
        setDuration(durationValue)
        const fpsValue = fpsRef.current > 0 ? fpsRef.current : DEFAULT_FPS
        const frameCount = Math.max(1, Math.round(durationValue * fpsValue))
        onMetadata?.({ duration: durationValue, fps: fpsRef.current, frameCount })
      }

      const time = video.currentTime
      if (!Number.isFinite(time)) {
        return
      }
      const index = computeFrameIndex(time, fpsRef.current)
      if (
        lastFrameRef.current === index &&
        lastTimeRef.current !== -1 &&
        Math.abs(time - lastTimeRef.current) < TIME_EPSILON
      ) {
        return
      }
      emitTime(time, index)
    }, [computeFrameIndex, emitTime, onMetadata])

    const seekTo = useCallback(
      (time: number) => {
        const video = videoRef.current
        if (!video) return
        const limit = durationRef.current > 0 ? durationRef.current : getIntrinsicDuration(video)
        const clamped = clamp(time, 0, limit > 0 ? limit : Number.isFinite(video.duration) ? video.duration : 0)
        if (video.currentTime !== clamped) {
          video.currentTime = clamped
        }
        updateFromVideo()
      },
      [updateFromVideo],
    )

    const pause = useCallback(() => {
      videoRef.current?.pause()
    }, [])

    const stepFrames = useCallback(
      (delta: number) => {
        const video = videoRef.current
        if (!video) return
        const fpsValue = fpsRef.current > 0 ? fpsRef.current : DEFAULT_FPS
        const next = video.currentTime + delta / fpsValue
        pause()
        seekTo(next)
      },
      [pause, seekTo],
    )

    useImperativeHandle(
      ref,
      () => ({
        seekTo,
        stepFrames,
        getCurrentTime: () => currentTime,
        pause,
      }),
      [currentTime, pause, seekTo, stepFrames],
    )

    useEffect(() => {
      const video = videoRef.current
      if (!video) {
        return
      }

      const handleLoadedMetadata = () => {
        durationRef.current = 0
        updateFromVideo()
        if (autoPlay) {
          void video.play()
        }
      }

      const handlePlay = () => setIsPlaying(true)
      const handlePause = () => {
        setIsPlaying(false)
        updateFromVideo()
      }

      video.addEventListener("loadedmetadata", handleLoadedMetadata)
      video.addEventListener("play", handlePlay)
      video.addEventListener("pause", handlePause)
      video.addEventListener("timeupdate", updateFromVideo)

      if (video.readyState >= 1) {
        handleLoadedMetadata()
      }

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata)
        video.removeEventListener("play", handlePlay)
        video.removeEventListener("pause", handlePause)
        video.removeEventListener("timeupdate", updateFromVideo)
      }
    }, [autoPlay, updateFromVideo])

    useEffect(() => {
      const video = videoRef.current
      if (!video || !("requestVideoFrameCallback" in video)) {
        return
      }

      const callback: VideoFrameRequestCallback = (_ts, metadata) => {
        if (metadata.presentedFrames > 0 && metadata.mediaTime > 0) {
          const estimate = metadata.presentedFrames / metadata.mediaTime
          if (Number.isFinite(estimate) && estimate > 0) {
            fpsRef.current = estimate
          }
        }
        frameCallbackRef.current = video.requestVideoFrameCallback(callback)
      }

      frameCallbackRef.current = video.requestVideoFrameCallback(callback)

      return () => {
        if (frameCallbackRef.current !== null && "cancelVideoFrameCallback" in video) {
          video.cancelVideoFrameCallback(frameCallbackRef.current)
        }
      }
    }, [])

    useEffect(() => {
      const interval = window.setInterval(() => {
        updateFromVideo()
      }, POLL_INTERVAL_MS)
      return () => {
        window.clearInterval(interval)
      }
    }, [updateFromVideo])

    useEffect(() => {
      const video = videoRef.current
      if (!fileUrl || !video) {
        return
      }

      video.src = fileUrl
      video.load()
      wasPlayingRef.current = false
      lastTimeRef.current = -1
      lastFrameRef.current = -1
      updateFromVideo()
    }, [fileUrl, updateFromVideo])

    useEffect(() => {
      const handleKeydown = (event: KeyboardEvent) => {
        const video = videoRef.current
        if (!video) return
        const target = event.target as HTMLElement | null
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          return
        }
        switch (event.key) {
          case " ":
            event.preventDefault()
            if (video.paused) {
              void video.play()
            } else {
              video.pause()
            }
            break
          case "ArrowLeft":
            event.preventDefault()
            stepFrames(-1)
            break
          case "ArrowRight":
            event.preventDefault()
            stepFrames(1)
            break
          case "ArrowUp":
            event.preventDefault()
            pause()
            seekTo(0)
            break
          case "ArrowDown":
            event.preventDefault()
            pause()
            seekTo(getIntrinsicDuration(video))
            break
          case "q":
          case "Q":
            event.preventDefault()
            pause()
            break
          default:
            break
        }
      }

      window.addEventListener("keydown", handleKeydown)
      return () => window.removeEventListener("keydown", handleKeydown)
    }, [pause, seekTo, stepFrames])

    useEffect(() => {
      const container = videoRef.current?.parentElement
      if (!container) {
        return
      }
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        const delta = Math.sign(event.deltaY)
        stepFrames(delta > 0 ? 1 : -1)
      }
      container.addEventListener("wheel", handleWheel, { passive: false })
      return () => container.removeEventListener("wheel", handleWheel)
    }, [stepFrames])

    const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.currentTarget.value)
      if (!Number.isFinite(value)) {
        return
      }
      seekTo(value)
    }

    const handleScrubStart = () => {
      const video = videoRef.current
      if (!video) return
      wasPlayingRef.current = !video.paused
      video.pause()
    }

    const handleScrubEnd = () => {
      const video = videoRef.current
      if (!video) return
      if (wasPlayingRef.current) {
        void video.play()
      }
      wasPlayingRef.current = false
    }

    const togglePlayback = useCallback(() => {
      const video = videoRef.current
      if (!video) return
      if (video.paused) {
        void video.play()
      } else {
        video.pause()
      }
    }, [])

    const sliderMax = useMemo(() => {
      const video = videoRef.current
      const intrinsic = video ? getIntrinsicDuration(video) : 0
      return duration > 0 ? duration : intrinsic
    }, [duration, fileUrl])

    const formattedLabel = useMemo(() => {
      if (!sliderMax) {
        return "0 / 0 (0.00s)"
      }
      const totalFrames = Math.max(1, Math.round(sliderMax * (fpsRef.current > 0 ? fpsRef.current : DEFAULT_FPS)))
      const safeIndex = clamp(frameIndex, 0, totalFrames - 1)
      return `${safeIndex} / ${totalFrames - 1} (${formatSeconds(currentTime, 2)}s)`
    }, [currentTime, frameIndex, sliderMax])

    return (
      <div className={cn("flex h-full flex-col gap-2", className)}>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-border bg-black">
          {fileUrl ? (
            <video ref={videoRef} className="h-full w-full" controls={false} preload="metadata" playsInline />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">Select a video file to begin</div>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <input
            type="range"
            min={0}
            max={sliderMax || 0}
            step={fpsRef.current > 0 ? 1 / fpsRef.current : 0.001}
            value={Math.min(currentTime, sliderMax || 0)}
            onChange={handleSliderChange}
            onInput={handleSliderChange}
            onMouseDown={handleScrubStart}
            onMouseUp={handleScrubEnd}
            onTouchStart={handleScrubStart}
            onTouchEnd={handleScrubEnd}
            className="w-full accent-primary"
            disabled={!fileUrl}
          />
          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span>{formattedLabel}</span>
            <span>{sliderMax ? `${sliderMax.toFixed(2)}s` : "0.00s"}</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button size="icon" variant="outline" onClick={() => stepFrames(-1)} disabled={!fileUrl}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={togglePlayback} disabled={!fileUrl}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={() => stepFrames(1)} disabled={!fileUrl}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

VideoPlayer.displayName = "VideoPlayer"
