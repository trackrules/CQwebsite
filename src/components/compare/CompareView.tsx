import { useCallback, useMemo, useState } from "react"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ValueType } from "recharts/types/component/DefaultTooltipContent"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { annotateDiffs, buildSplitTimeRows, buildTotalTimeRows, buildSeriesForChart } from "@/lib/compare"
import { distanceToLabel, formatSeconds } from "@/lib/utils"
import type { ComparisonMode, Granularity, Session } from "@/types/session"

const GRANULARITY_LABELS: Record<Granularity, string> = {
  quarter: "¼ lap",
  half: "½ lap",
  full: "Full lap",
}

const MODE_LABELS: Record<ComparisonMode, string> = {
  total: "Total time",
  split: "Split time",
}

type CompareViewProps = {
  sessions: Session[]
  selectedKeys: string[]
  onSelectedKeysChange: (keys: string[]) => void
  onReload: () => Promise<void>
}

type ChartRow = { distance: number } & Record<string, number | null>

function makeSessionLabel(session: Session): string {
  const base = session.video.split(/[\\/]/).at(-1) ?? session.video
  const noExt = base.replace(/\.[^.]+$/, "")
  const athlete = session.athlete?.trim()
  return `${athlete || "Unknown"} • ${noExt}`
}

const tooltipFormatter = (value: ValueType): string => {
  if (typeof value === "number") {
    return `${formatSeconds(value, 2)} s`
  }
  return "—"
}

export function CompareView({ sessions, selectedKeys, onSelectedKeysChange, onReload }: CompareViewProps) {
  const [mode, setMode] = useState<ComparisonMode>("total")
  const [granularity, setGranularity] = useState<Granularity>("quarter")
  const [referenceKey, setReferenceKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("graph")
  const [filterTerm, setFilterTerm] = useState("")

  const filteredSessions = useMemo(() => {
    if (!filterTerm.trim()) {
      return sessions
    }
    const lower = filterTerm.toLowerCase()
    return sessions.filter((session) => makeSessionLabel(session).toLowerCase().includes(lower))
  }, [filterTerm, sessions])

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedKeys.includes(session.videoKey)),
    [sessions, selectedKeys],
  )

  const sessionLabels = useMemo(() => {
    const labels = new Map<string, string>()
    for (const session of sessions) {
      labels.set(session.videoKey, makeSessionLabel(session))
    }
    return labels
  }, [sessions])

  const chartData = useMemo(() => {
    const unionDistances = new Set<number>()
    const timeMap = new Map<string, Map<number, number>>()
    for (const session of selectedSessions) {
      const series = buildSeriesForChart(session)
      const map = new Map<number, number>()
      for (const point of series) {
        const roundedDistance = Number(point.distance.toFixed(3))
        unionDistances.add(roundedDistance)
        map.set(roundedDistance, point.time)
      }
      timeMap.set(session.videoKey, map)
    }
    const distances = Array.from(unionDistances).sort((a, b) => a - b)
    return distances.map<ChartRow>((distance) => {
      const row: ChartRow = { distance }
      for (const session of selectedSessions) {
        row[session.videoKey] = timeMap.get(session.videoKey)?.get(distance) ?? null
      }
      return row
    })
  }, [selectedSessions])

  const tableRows = useMemo(() => {
    if (selectedSessions.length === 0) {
      return []
    }
    if (mode === "split") {
      return annotateDiffs(buildSplitTimeRows(selectedSessions, granularity), referenceKey)
    }
    return annotateDiffs(buildTotalTimeRows(selectedSessions), referenceKey)
  }, [selectedSessions, mode, granularity, referenceKey])

  const handleSelectionToggle = useCallback(
    (key: string, checked: boolean) => {
      if (checked) {
        onSelectedKeysChange(Array.from(new Set([...selectedKeys, key])))
      } else {
        onSelectedKeysChange(selectedKeys.filter((item) => item !== key))
        if (referenceKey === key) {
          setReferenceKey(null)
        }
      }
    },
    [onSelectedKeysChange, selectedKeys, referenceKey],
  )

  const handleSelectAll = useCallback(() => {
    onSelectedKeysChange(sessions.map((session) => session.videoKey))
  }, [onSelectedKeysChange, sessions])

  const handleClear = useCallback(() => {
    onSelectedKeysChange([])
    setReferenceKey(null)
  }, [onSelectedKeysChange])

  const handleReload = useCallback(async () => {
    await onReload()
    setReferenceKey(null)
  }, [onReload])

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleReload}>
            Reload
          </Button>
          <Button size="sm" variant="secondary" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          <Label>Table mode</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as ComparisonMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as ComparisonMode[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {MODE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3">
          <Label>Granularity</Label>
          <Select
            value={granularity}
            onValueChange={(value) => setGranularity(value as Granularity)}
            disabled={mode !== "split"}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {GRANULARITY_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3">
          <Label htmlFor="compare-filter">Filter list</Label>
          <Input
            id="compare-filter"
            placeholder="Type to filter"
            value={filterTerm}
            onChange={(event) => setFilterTerm(event.target.value)}
          />
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {filteredSessions.map((session) => (
              <label key={session.videoKey} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedKeys.includes(session.videoKey)}
                  onCheckedChange={(checked) => handleSelectionToggle(session.videoKey, Boolean(checked))}
                />
                <span>{makeSessionLabel(session)}</span>
              </label>
            ))}
            {filteredSessions.length === 0 && (
              <span className="text-sm text-muted-foreground">No sessions match filter.</span>
            )}
          </div>
        </div>
        {!!referenceKey && (
          <p className="text-xs text-muted-foreground">Reference: {sessionLabels.get(referenceKey)}</p>
        )}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <TabsContent value="graph" className="mt-4 h-[420px]">
            {selectedSessions.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select at least one session to plot.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 16, right: 16, top: 16, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
                  <XAxis dataKey="distance" name="Distance" tickFormatter={distanceToLabel} />
                  <YAxis
                    name="Time"
                    tickFormatter={(value) => formatSeconds(Number(value), 2)}
                    allowDecimals
                  />
                  <Tooltip
                    formatter={(value) => tooltipFormatter(value as ValueType)}
                    labelFormatter={(distance: number) => `${distanceToLabel(distance)} m`}
                  />
                  <Legend />
                  {selectedSessions.map((session, index) => (
                    <Line
                      key={session.videoKey}
                      type="monotone"
                      dataKey={session.videoKey}
                      name={sessionLabels.get(session.videoKey) ?? session.videoKey}
                      stroke={COLORS[index % COLORS.length]}
                      dot={{ r: 4 }}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
          <TabsContent value="table" className="mt-4">
            {tableRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Select sessions to build the comparison table.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Distance</TableHead>
                    {selectedSessions.map((session) => {
                      const isReference = referenceKey === session.videoKey
                      return (
                        <TableHead
                          key={session.videoKey}
                          className={isReference ? "font-semibold" : "cursor-pointer"}
                          onClick={() => setReferenceKey(session.videoKey)}
                        >
                          {sessionLabels.get(session.videoKey)} {isReference ? "(ref)" : ""}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.distance}>
                      <TableCell>{row.label === "Start" ? row.label : `${row.label} m`}</TableCell>
                      {selectedSessions.map((session) => {
                        const value = row.values[session.videoKey]
                        const delta = row.deltas[session.videoKey]
                        const isReference = referenceKey === session.videoKey
                        return (
                          <TableCell
                            key={`${session.videoKey}-${row.distance}`}
                            onClick={() => setReferenceKey(session.videoKey)}
                            className={isReference ? "font-mono" : "cursor-pointer font-mono"}
                          >
                            {value == null ? "—" : formatSeconds(value, 2)}
                            {!isReference && delta != null && (
                              <span className="ml-2 italic text-muted-foreground">
                                {delta >= 0 ? "+" : ""}
                                {delta.toFixed(2)}
                              </span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

const COLORS = [
  "#38bdf8",
  "#f472b6",
  "#a855f7",
  "#34d399",
  "#fbbf24",
  "#f97316",
  "#60a5fa",
  "#f87171",
]

