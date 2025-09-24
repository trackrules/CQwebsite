import type { ChangeEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { AnnotateView } from "@/components/annotate/AnnotateView"
import { CompareView } from "@/components/compare/CompareView"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { exportSessions, getAllSessions, importSessions, saveSession } from "@/store/sessions"
import type { Session } from "@/types/session"

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("annotate")
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement | null>(null)

  const loadSessions = useCallback(async () => {
    const list = await getAllSessions()
    list.sort((a, b) => (a.video ?? "").localeCompare(b.video ?? ""))
    setSessions(list)
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    setSelectedKeys((keys) => keys.filter((key) => sessions.some((session) => session.videoKey === key)))
  }, [sessions])

  const handlePersistSession = useCallback(
    async (session: Session) => {
      await saveSession(session)
      await loadSessions()
      setActiveTab("compare")
    },
    [loadSessions],
  )

  const handleExport = useCallback(async () => {
    const payload = await exportSessions()
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "sessions.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }
      try {
        const text = await file.text()
        const count = await importSessions(text)
        setImportStatus(`Imported ${count} session${count === 1 ? "" : "s"}.`)
        await loadSessions()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setImportStatus(`Import failed: ${message}`)
      } finally {
        event.target.value = ""
      }
    },
    [loadSessions],
  )

  const handleReload = useCallback(async () => {
    await loadSessions()
  }, [loadSessions])

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedKeys.includes(session.videoKey)),
    [sessions, selectedKeys],
  )

  return (
    <div className="mx-auto flex h-screen max-w-[1600px] flex-col gap-4 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Cycling Annotator</h1>
          <p className="text-sm text-muted-foreground">
            Annotate track sprints, extract splits, and compare efforts without leaving your browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport}>
            Export sessions
          </Button>
          <Button variant="secondary" onClick={() => importRef.current?.click()}>
            Import sessions
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </header>
      {importStatus && <p className="text-xs text-muted-foreground">{importStatus}</p>}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="w-fit">
          <TabsTrigger value="annotate">Annotate</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="annotate" className="flex-1 overflow-hidden" forceMount>
          <AnnotateView onPersistSession={handlePersistSession} />
        </TabsContent>
        <TabsContent value="compare" className="flex-1 overflow-hidden" forceMount>
          <CompareView
            sessions={sessions}
            selectedKeys={selectedKeys}
            onSelectedKeysChange={setSelectedKeys}
            onReload={handleReload}
          />
        </TabsContent>
      </Tabs>
      {selectedSessions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Selected sessions: {selectedSessions.map((session) => session.video).join(", ")}
        </p>
      )}
    </div>
  )
}

