import { useEffect, useMemo, useState } from "react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildSplitDistances } from "@/lib/splits"
import { buildMetrics } from "@/lib/metrics"
import { distanceToLabel } from "@/lib/utils"
import type { SplitChoice } from "@/types/session"

type MetricsPanelProps = {
  marks: Record<string, number | null>
  distanceTotal: number
  activeChoice: SplitChoice
}

const TAB_CONFIG: Array<{ key: SplitChoice; label: string }> = [
  { key: "quarter", label: "¼ Lap" },
  { key: "half", label: "½ Lap" },
  { key: "full", label: "Full Lap" },
]

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "—"
  }
  return value.toFixed(digits)
}

export function MetricsPanel({ marks, distanceTotal, activeChoice }: MetricsPanelProps) {
  const visibleTabs = useMemo(() => {
    switch (activeChoice) {
      case "quarter":
        return TAB_CONFIG
      case "half":
        return TAB_CONFIG.filter((tab) => tab.key !== "quarter")
      case "full":
        return TAB_CONFIG.filter((tab) => tab.key === "full")
      default:
        return TAB_CONFIG
    }
  }, [activeChoice])

  const [selectedTab, setSelectedTab] = useState<SplitChoice>(visibleTabs[0]?.key ?? "quarter")

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === selectedTab)) {
      setSelectedTab(visibleTabs[0]?.key ?? activeChoice)
    }
  }, [activeChoice, selectedTab, visibleTabs])

  return (
    <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as SplitChoice)} className="w-full">
      <TabsList>
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {visibleTabs.map((tab) => {
        const distances = buildSplitDistances(distanceTotal, tab.key)
        const metrics = buildMetrics(distances, marks)
        return (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            {metrics.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Add more timestamps to see segment metrics.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From (m)</TableHead>
                    <TableHead>To (m)</TableHead>
                    <TableHead>Δt (s)</TableHead>
                    <TableHead>Δd (m)</TableHead>
                    <TableHead>v (km/h)</TableHead>
                    <TableHead>a (m/s²)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((row) => (
                    <TableRow key={`${row.from}-${row.to}`}>
                      <TableCell>{distanceToLabel(row.from)}</TableCell>
                      <TableCell>{distanceToLabel(row.to)}</TableCell>
                      <TableCell className="font-mono">{formatNumber(row.deltaT, 3)}</TableCell>
                      <TableCell className="font-mono">{formatNumber(row.deltaD, 1)}</TableCell>
                      <TableCell className="font-mono">{formatNumber(row.velocityKmh, 2)}</TableCell>
                      <TableCell className="font-mono">{row.acceleration === null ? "—" : formatNumber(row.acceleration, 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
