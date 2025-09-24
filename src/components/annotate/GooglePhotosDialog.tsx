import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createGoogleAuthRequest, storePendingGoogleAuth } from "@/lib/google-oauth"

const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI

const missingConfig = !clientId || !redirectUri

export type GooglePhotosDialogProps = {
  open: boolean
  onClose: () => void
  onSelectLocal: () => void
  onSelectPhoneUpload: () => void
}

export function GooglePhotosDialog({ open, onClose, onSelectLocal, onSelectPhoneUpload }: GooglePhotosDialogProps) {
  const handleGoogle = async () => {
    if (missingConfig) {
      window.alert("Google OAuth environment variables are not configured. Please update .env.local.")
      return
    }
    try {
      const request = await createGoogleAuthRequest()
      storePendingGoogleAuth(request)
      window.location.href = request.url
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("Failed to start Google Photos OAuth flow", error)
      window.alert(`Failed to start Google Photos OAuth flow: ${message}`)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-background/95 text-sm text-foreground">
        <DialogHeader>
          <DialogTitle>Choose Video Source</DialogTitle>
          <p className="text-xs text-muted-foreground">Select where you want to import a video from.</p>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={onSelectLocal} className="bg-purple-600 text-white hover:bg-purple-500">
            Open from local storage
          </Button>
          <Button variant="outline" onClick={() => void handleGoogle()}>
            Open from Google Photos
          </Button>
          <Button variant="ghost" className="border border-dashed border-purple-400/50 text-purple-200 hover:bg-purple-500/10" onClick={onSelectPhoneUpload}>
            Upload from phone via QR
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-xs text-muted-foreground">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
