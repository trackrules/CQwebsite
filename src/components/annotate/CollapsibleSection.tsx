import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

type CollapsibleSectionProps = {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  highlight?: boolean
}

export function CollapsibleSection({ title, children, defaultOpen = true, highlight = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-background/80 shadow-sm transition-colors",
        highlight ? "border-purple-500/70" : "border-purple-400/40",
        open ? "" : "opacity-90",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-t-lg px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-purple-200 hover:bg-purple-500/10"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 text-sm text-purple-50/90">{children}</div>}
    </div>
  )
}
