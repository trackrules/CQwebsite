import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { formatSeconds, parseTimeInput } from "@/lib/utils"

const STATIC_LABELS = ["Start time", "Reaction time", "15"] as const

export type LabelOption = (typeof STATIC_LABELS)[number] | string

type TimestampGridProps = {
  labelOrder: LabelOption[]
  marksAbs: Record<string, number | null>
  marksRel: Record<string, number | null>
  currentTime: number
  onUpdate: (label: string, absoluteSeconds: number | null) => void
  startSet: boolean
}

export function TimestampGrid({ labelOrder, marksAbs, marksRel, currentTime, onUpdate, startSet }: TimestampGridProps) {
  const [editing, setEditing] = useState<Record<string, string>>({})

  useEffect(() => {
    setEditing({})
  }, [marksAbs])

  const toInputValue = (seconds: number): string => {
    if (!Number.isFinite(seconds)) {
      return ""
    }
    return seconds.toFixed(2)
  }

  const handleFocus = (label: string) => {
    let value = currentTime
    if (label !== "Start time") {
      const startAbs = marksAbs["Start time"]
      if (startAbs !== null && startAbs !== undefined) {
        value = Math.max(0, value - startAbs)
      }
    }
    setEditing((prev) => ({ ...prev, [label]: toInputValue(value) }))
  }

  const handleChange = (label: string, value: string) => {
    setEditing((prev) => ({ ...prev, [label]: value }))
  }

  const handleBlur = (label: string) => {
    setEditing((prev) => {
      const { [label]: _removed, ...rest } = prev
      return rest
    })
  }

  const commitValue = (label: string) => {
    const value = editing[label]
    if (value === undefined) {
      return
    }
    const parsed = parseTimeInput(value)
    if (parsed === null) {
      handleBlur(label)
      return
    }

    if (label === "Start time") {
      onUpdate(label, Math.max(parsed, 0))
      handleBlur(label)
      return
    }

    const startAbs = marksAbs["Start time"]
    if (startAbs === null || startAbs === undefined) {
      handleBlur(label)
      return
    }

    const absolute = Math.max(startAbs, startAbs + parsed)
    onUpdate(label, absolute)
    handleBlur(label)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, label: string) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commitValue(label)
    }
    if (event.key === "Escape") {
      event.preventDefault()
      handleBlur(label)
    }
    if (event.key === "Backspace" && event.ctrlKey) {
      event.preventDefault()
      onUpdate(label, null)
      handleBlur(label)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {labelOrder.map((label) => {
        const isStart = label === "Start time"
        const relativeValue = isStart ? (startSet ? 0 : null) : marksRel[label] ?? null
        const display = isStart ? (startSet ? "0.00" : "--.--") : formatSeconds(relativeValue)
        const editingValue = editing[label]
        return (
          <div key={label} className="flex items-center gap-3 rounded-md border border-purple-500/40 bg-purple-500/5 px-3 py-2">
            <span className="text-xs font-medium text-purple-100 w-28 truncate">{label}</span>
            <Input
              id={`timestamp-${label}`}
              value={editingValue ?? display}
              onFocus={() => handleFocus(label)}
              onChange={(event) => handleChange(label, event.target.value)}
              onBlur={() => handleBlur(label)}
              onKeyDown={(event) => handleKeyDown(event, label)}
              disabled={!startSet && !isStart}
              placeholder={isStart ? "Start time" : startSet ? "0.00" : "--.--"}
              className="text-right"
            />
          </div>
        )
      })}
    </div>
  )
}
