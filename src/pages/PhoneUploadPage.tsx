import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const uploadServerEnv = import.meta.env.VITE_UPLOAD_SERVER_URL ?? "http://localhost:3030"

export function PhoneUploadPage() {
  const search = useMemo(() => (typeof window !== "undefined" ? window.location.search : ""), [])
  const sessionId = useMemo(() => new URLSearchParams(search).get("session"), [search])
  const [files, setFiles] = useState<File[]>([])
  const [serverUrl, setServerUrl] = useState(uploadServerEnv)
  const [status, setStatus] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [inputKey, setInputKey] = useState(0)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sessionId) {
      setStatus("Missing session information. Re-scan the QR code from the desktop app.")
      return
    }
    if (files.length === 0) {
      setStatus("Select at least one video before uploading.")
      return
    }
    setIsUploading(true)
    setStatus(`Uploading ${files.length} ${files.length === 1 ? "video" : "videos"}…`)
    try {
      const formData = new FormData()
      formData.append("sessionId", sessionId)
      files.forEach((item) => {
        formData.append("video", item)
      })
      const baseUrl = serverUrl.replace(/\/$/, "")
      const response = await fetch(`${baseUrl}/api/uploads`, {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Upload failed: ${response.status} ${text}`)
      }
      const uploadedCount = files.length
      setStatus(`Uploaded ${uploadedCount} ${uploadedCount === 1 ? "video" : "videos"}! You can return to your desktop browser.`)
      setFiles([])
      setInputKey((key) => key + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-10">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Cycling Annotator Upload</h1>
          <p className="text-sm text-slate-300">
            Upload one or more videos from this device. Keep the desktop dialog open so it can download the files automatically.
          </p>
        </header>
        {!sessionId ? (
          <div className="rounded-md border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Missing session identifier. Make sure you opened this page from the QR code generated on the desktop app.
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="video" className="text-sm font-medium text-slate-200">
                Video files
              </Label>
              <Input
                id="video"
                type="file"
                accept="video/*"
                multiple
                key={inputKey}
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="bg-slate-900"
              />
              {files.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-[11px] text-slate-300">
                  {files.map((selectedFile) => (
                    <li key={`${selectedFile.name}-${selectedFile.lastModified}`}>{selectedFile.name}</li>
                  ))}
                </ul>
              ) : null}
              <span className="text-[11px] text-slate-400">Large uploads depend on your network speed. Keep this page open until the upload completes.</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="server" className="text-sm font-medium text-slate-200">
                Upload server URL
              </Label>
              <Input
                id="server"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                spellCheck={false}
                className="bg-slate-900"
              />
              <span className="text-[11px] text-slate-400">Example: http://192.168.1.24:3030</span>
            </div>
            <Button type="submit" disabled={isUploading} className="bg-purple-600 text-white hover:bg-purple-500">
              {isUploading ? "Uploading…" : files.length > 1 ? "Upload videos" : "Upload video"}
            </Button>
          </form>
        )}
        {status && (
          <div className="rounded-md border border-purple-400/60 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
            {status}
          </div>
        )}
        <footer className="text-center text-[11px] text-slate-500">
          Session: {sessionId ?? "n/a"}
        </footer>
      </div>
    </div>
  )
}
