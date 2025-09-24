import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const DEFAULT_WIDTH = 260

type PhoneUploadDialogProps = {
  open: boolean
  onClose: () => void
  onSessionStart: (sessionId: string) => void
  onSessionEnd: () => void
  uploadServerUrl: string
}

export function PhoneUploadDialog({ open, onClose, onSessionStart, onSessionEnd, uploadServerUrl }: PhoneUploadDialogProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [publicBaseUrl, setPublicBaseUrl] = useState<string>(() => {
    if (typeof window === "undefined") {
      return ""
    }
    const { protocol, hostname, port } = window.location
    const safeHostname = hostname === "localhost" ? hostname : hostname
    return `${protocol}//${safeHostname}${port ? `:${port}` : ""}`
  })
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSessionId(null)
      setQrDataUrl(null)
      setQrError(null)
      onSessionEnd()
      return
    }
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : `session-${Date.now()}`
    setSessionId(id)
    onSessionStart(id)
  }, [open, onSessionEnd, onSessionStart])

  const uploadUrl = useMemo(() => {
    if (!sessionId) {
      return ""
    }
    const base = publicBaseUrl.trim().replace(/\/$/, "")
    if (!base) {
      return ""
    }
    return `${base}/phone-upload?session=${sessionId}`
  }, [publicBaseUrl, sessionId])

  useEffect(() => {
    if (!uploadUrl) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    const generate = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(uploadUrl, { margin: 1, width: DEFAULT_WIDTH })
        if (!cancelled) {
          setQrDataUrl(dataUrl)
          setQrError(null)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error)
          setQrError(message)
        }
      }
    }
    void generate()
    return () => {
      cancelled = true
    }
  }, [uploadUrl])

  const handleCopy = async () => {
    if (!uploadUrl || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return
    }
    try {
      await navigator.clipboard.writeText(uploadUrl)
      alert("Link copied to clipboard")
    } catch (error) {
      console.error("Failed to copy", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-lg bg-background/95 text-sm text-foreground">
        <DialogHeader>
          <DialogTitle>Upload from your phone</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Make sure your computer and phone are on the same network. Replace "localhost" with your computer&rsquo;s LAN IP if your phone cannot load the page.
          </p>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Desktop base URL</span>
            <Input value={publicBaseUrl} onChange={(event) => setPublicBaseUrl(event.target.value)} spellCheck={false} />
            <span className="text-[11px] text-muted-foreground">
              Example: <code>http://192.168.1.24:5173</code>
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            {qrError ? (
              <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Failed to generate QR code: {qrError}
              </div>
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="Upload link QR code" className="h-64 w-64 rounded-lg border border-border bg-white p-3" />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                Generating QR code…
              </div>
            )}
            {uploadUrl && (
              <div className="flex w-full flex-col items-center gap-2">
                <code className="break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{uploadUrl}</code>
                <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
                  Copy link
                </Button>
              </div>
            )}
          </div>
          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-6">
              <li>Scan the QR code with your phone and open the link.</li>
              <li>Select a video file on your phone and upload it.</li>
              <li>Keep this dialog open. The video will load automatically when the upload finishes.</li>
            </ol>
          </div>
          <div className="rounded-md border border-purple-400/50 bg-purple-500/10 px-4 py-3 text-xs text-purple-100">
            Upload server: <code className="break-all text-purple-200">{uploadServerUrl}</code>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-xs text-muted-foreground">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
