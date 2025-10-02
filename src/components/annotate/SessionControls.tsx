import { useEffect, useMemo, useState, type KeyboardEvent } from "react"

import { CollapsibleSection } from "@/components/annotate/CollapsibleSection"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SplitChoice, StartType } from "@/types/session"

const splitLabels: Record<SplitChoice, string> = {
  quarter: "Quarter lap (62.5 m)",
  half: "Half lap (125 m)",
  full: "Full lap (250 m)",
}

const startTypeLabels: StartType[] = ["ST", "FT", "Other"]

type SessionControlsProps = {
  fileName: string | null
  fps: number | null
  dateIso: string | null
  onDateChange: (value: string | null) => void
  timeOfDay: string | null
  onTimeOfDayChange: (value: string | null) => void
  group: string | null
  onGroupChange: (value: string) => void
  riders: string[]
  onRidersChange: (value: string) => void
  rep: number | null
  onRepChange: (value: number | null) => void
  athlete: string
  onAthleteChange: (value: string) => void
  startType: StartType
  onStartTypeChange: (value: StartType) => void
  distanceTotal: number
  onDistanceTotalChange: (value: number | null) => void
  splitChoice: SplitChoice
  onSplitChoiceChange: (value: SplitChoice) => void
  onApplySplits: () => void
  distances: number[]
  onDistanceChange: (index: number, value: number | null) => void
  onDistanceRemove: (index: number) => void
  onDistanceAdd: () => void
  onSaveSession: () => void
  statusMessage: string | null
}

export function SessionControls({
  fileName,
  fps,
  dateIso,
  onDateChange,
  timeOfDay,
  onTimeOfDayChange,
  group,
  onGroupChange,
  riders,
  onRidersChange,
  rep,
  onRepChange,
  athlete,
  onAthleteChange,
  startType,
  onStartTypeChange,
  distanceTotal,
  onDistanceTotalChange,
  splitChoice,
  onSplitChoiceChange,
  onApplySplits,
  distances,
  onDistanceChange,
  onDistanceRemove,
  onDistanceAdd,
  onSaveSession,
  statusMessage,
}: SessionControlsProps) {
  const [trackInput, setTrackInput] = useState("")
  const [ridersInput, setRidersInput] = useState("")
  const [distanceEdits, setDistanceEdits] = useState<Record<number, string>>({})

  useEffect(() => {
    setTrackInput(distanceTotal ? distanceTotal.toString() : "")
  }, [distanceTotal])

  const ridersValue = useMemo(() => riders.join(", "), [riders])

  useEffect(() => {
    setRidersInput(ridersValue)
  }, [ridersValue])

  useEffect(() => {
    setDistanceEdits({})
  }, [distances])

  const commitTrackDistance = () => {
    const trimmed = trackInput.trim()
    if (!trimmed) {
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return
    }
    onDistanceTotalChange(parsed)
  }

  const handleDistanceFocus = (index: number, value: number) => {
    setDistanceEdits((prev) => ({ ...prev, [index]: value.toString() }))
  }

  const handleDistanceChangeInternal = (index: number, value: string) => {
    setDistanceEdits((prev) => ({ ...prev, [index]: value }))
  }

  const clearDistanceEdit = (index: number) => {
    setDistanceEdits((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const commitDistance = (index: number) => {
    const raw = distanceEdits[index]
    if (raw === undefined) {
      return
    }
    const trimmed = raw.trim()
    if (!trimmed) {
      onDistanceRemove(index)
      clearDistanceEdit(index)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      clearDistanceEdit(index)
      return
    }
    onDistanceChange(index, parsed)
    clearDistanceEdit(index)
  }

  const handleDistanceKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commitDistance(index)
    }
    if (event.key === "Escape") {
      event.preventDefault()
      clearDistanceEdit(index)
    }
    if (event.key === "Backspace" && event.ctrlKey) {
      event.preventDefault()
      onDistanceRemove(index)
      clearDistanceEdit(index)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection title="Session Details" defaultOpen highlight>
        <div className="flex flex-col gap-3 text-purple-50/90">
          <div className="grid grid-cols-2 gap-2 text-xs text-purple-200">
            <span className="font-medium text-purple-200">File</span>
            <span className="text-purple-100">{fileName ?? "-"}</span>
            <span className="font-medium text-purple-200">FPS</span>
            <span className="text-purple-100">{fps ? fps.toFixed(2) : "-"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Date</span>
            <Input
              id="session-date"
              type="date"
              value={dateIso ?? ""}
              onChange={(event) => onDateChange(event.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Video start time</span>
            <Input
              id="session-time"
              type="time"
              step={1}
              value={timeOfDay ?? ""}
              onChange={(event) => onTimeOfDayChange(event.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Group</span>
            <Input
              id="session-group"
              value={group ?? ""}
              onChange={(event) => onGroupChange(event.target.value)}
              placeholder="Squad / training group"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Riders</span>
            <Input
              id="session-riders"
              value={ridersInput}
              onChange={(event) => setRidersInput(event.target.value)}
              onBlur={(event) => onRidersChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  onRidersChange(ridersInput)
                }
              }}
              placeholder="Alice, Bob, ..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Rep</span>
            <Input
              id="session-rep"
              type="number"
              min={1}
              step={1}
              value={rep ?? ""}
              onChange={(event) => {
                const value = event.target.value
                onRepChange(value ? Number(value) : null)
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Athlete</span>
            <Input
              id="session-athlete"
              value={athlete}
              onChange={(event) => onAthleteChange(event.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Start type</span>
            <Select value={startType} onValueChange={(value) => onStartTypeChange(value as StartType)}>
              <SelectTrigger>
                <SelectValue placeholder="Start type" />
              </SelectTrigger>
              <SelectContent>
                {startTypeLabels.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Track distance (m)</span>
            <Input
              id="session-track-distance"
              value={trackInput}
              onChange={(event) => setTrackInput(event.target.value)}
              onBlur={commitTrackDistance}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  commitTrackDistance()
                }
              }}
              placeholder="250"
            />
          </div>
        </div>
      </CollapsibleSection>

      {statusMessage && (
        <div className="rounded-lg border-2 border-purple-400/60 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
          {statusMessage}
        </div>
      )}

      <CollapsibleSection title="Splits" defaultOpen>
        <div className="flex flex-col gap-3 text-purple-50/90">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Split every</span>
            <Select value={splitChoice} onValueChange={(value) => onSplitChoiceChange(value as SplitChoice)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(splitLabels) as SplitChoice[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {splitLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" onClick={onApplySplits}>
            Apply template splits
          </Button>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-purple-200">Recorded distances (m)</span>
            {distances.length === 0 && (
              <p className="text-xs text-purple-200/70">No custom distances yet.</p>
            )}
            {distances.map((distance, index) => (
              <div key={`${index}-${distance}`} className="flex items-center gap-2">
                <Input
                  value={distanceEdits[index] ?? distance.toString()}
                  onFocus={() => handleDistanceFocus(index, distance)}
                  onChange={(event) => handleDistanceChangeInternal(index, event.target.value)}
                  onBlur={() => commitDistance(index)}
                  onKeyDown={(event) => handleDistanceKeyDown(event, index)}
                  className="flex-1"
                />
                <Button variant="ghost" size="sm" onClick={() => onDistanceRemove(index)}>
                  Remove
                </Button>
              </div>
            ))}
            <Button variant="secondary" onClick={onDistanceAdd} className="self-start">
              Add distance mark
            </Button>
          </div>
          <Button className="mt-2" onClick={onSaveSession}>
            Save session
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  )
}

