import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export type VideoSourceDialogProps = {
  open: boolean
  onClose: () => void
  onSelectLocal: () => void
  onSelectUrl: (url: string) => Promise<void>
  onSelectPhoneUpload: () => void
}

export function VideoSourceDialog({ open, onClose, onSelectLocal, onSelectUrl, onSelectPhoneUpload }: VideoSourceDialogProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null)
      setUrl("")
      onClose()
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setError("Enter a video URL to continue.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSelectUrl(trimmed)
      setUrl("")
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message || "Failed to load the provided URL.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-background/95 text-sm text-foreground">
        <DialogHeader>
          <DialogTitle>Choose Video Source</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Open a video from your computer, paste a public URL, or pull it in from your phone.
          </p>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-3">
          <Button onClick={onSelectLocal} className="bg-purple-600 text-white hover:bg-purple-500" disabled={submitting}>
            Open from local storage
          </Button>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-purple-400/40 bg-purple-500/5 p-3">
            <label className="text-xs font-medium text-purple-200" htmlFor="source-url">
              Load from URL
            </label>
            <Input
              id="source-url"
              type="url"
              placeholder="https://example.com/video.mp4"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={submitting}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" disabled={submitting} className="self-start">
              {submitting ? "Fetching..." : "Fetch video"}
            </Button>
          </form>
          <Button
            variant="ghost"
            className="border border-dashed border-purple-400/50 text-purple-200 hover:bg-purple-500/10"
            onClick={onSelectPhoneUpload}
            disabled={submitting}
          >
            Upload from phone via QR
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-xs text-muted-foreground" disabled={submitting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

