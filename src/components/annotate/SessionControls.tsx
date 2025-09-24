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
import type { ParsedFilename, SplitChoice, StartType } from "@/types/session"

const splitLabels: Record<SplitChoice, string> = {
  quarter: "¼ lap (62.5 m)",
  half: "½ lap (125 m)",
  full: "Full lap (250 m)",
}

const startTypeLabels: StartType[] = ["ST", "FT", "Other"]

type SessionControlsProps = {
  fileName: string | null
  fps: number | null
  parsed: ParsedFilename | null
  onAthleteChange: (value: string) => void
  onEffortChange: (value: number) => void
  athlete: string
  effort: number
  startType: StartType
  onStartTypeChange: (value: StartType) => void
  splitChoice: SplitChoice
  onSplitChoiceChange: (value: SplitChoice) => void
  onApplySplits: () => void
  onSaveSession: () => void
  statusMessage: string | null
}

export function SessionControls({
  fileName,
  fps,
  parsed,
  onAthleteChange,
  athlete,
  effort,
  onEffortChange,
  startType,
  onStartTypeChange,
  splitChoice,
  onSplitChoiceChange,
  onApplySplits,
  onSaveSession,
  statusMessage,
}: SessionControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection title="Metadata" defaultOpen highlight>
        <div className="grid grid-cols-2 gap-2 text-sm text-purple-50/90">
          <span className="font-medium text-purple-100">File</span>
          <span>{fileName ?? "-"}</span>
          <span className="font-medium text-purple-100">Date</span>
          <span>{parsed?.date_iso ?? "-"}</span>
          <span className="font-medium text-purple-100">Group</span>
          <span>{parsed?.group ?? "-"}</span>
          <span className="font-medium text-purple-100">Riders</span>
          <span>{parsed?.riders?.join(", ") || "-"}</span>
          <span className="font-medium text-purple-100">Start Type</span>
          <span>{parsed?.start_type ?? "-"}</span>
          <span className="font-medium text-purple-100">Rep</span>
          <span>{parsed?.rep ?? "-"}</span>
          <span className="font-medium text-purple-100">FPS</span>
          <span>{fps ? fps.toFixed(2) : "-"}</span>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Session" defaultOpen>
        <div className="flex flex-col gap-3 text-purple-50/90">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Athlete</span>
            <Input
              id="athlete"
              value={athlete}
              onChange={(event) => onAthleteChange(event.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-purple-200">Effort time (s)</span>
            <Input
              id="effort"
              type="number"
              min={0}
              step={0.01}
              value={Number.isFinite(effort) ? effort : ""}
              onChange={(event) => onEffortChange(Number(event.target.value))}
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
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onApplySplits}>
              Apply Splits
            </Button>
            <Button className="flex-1" onClick={onSaveSession}>
              💾 Save Session
            </Button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
