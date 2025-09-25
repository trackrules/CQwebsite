const express = require("express")
const cors = require("cors")
const multer = require("multer")
const { nanoid } = require("nanoid")
const fs = require("fs")
const path = require("path")

const PORT = Number.parseInt(process.env.UPLOAD_SERVER_PORT ?? process.env.PORT ?? "3030", 10)

const rootDir = path.resolve(__dirname, "..")
const uploadDir = path.join(rootDir, "uploads")
const metadataPath = path.join(uploadDir, "uploads.json")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

function readUploads() {
  try {
    const raw = fs.readFileSync(metadataPath, "utf8")
    return JSON.parse(raw)
  } catch (error) {
    if (error.code === "ENOENT") {
      return []
    }
    console.error("Failed to read uploads metadata", error)
    return []
  }
}

function writeUploads(list) {
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(list, null, 2), "utf8")
  } catch (error) {
    console.error("Failed to write uploads metadata", error)
  }
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "")
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 * 2, // 2 GB cap
    files: 12,
  },
})

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())
app.use("/uploads", express.static(uploadDir))

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.post("/api/uploads", upload.any(), (req, res) => {
  const sessionId = req.body?.sessionId
  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" })
  }
  const allowedFields = new Set(["video", "videos", "video[]", "file", "files"])
  const files = Array.isArray(req.files) ? req.files.filter((file) => allowedFields.has(file.fieldname)) : []
  if (files.length === 0) {
    return res.status(400).json({ error: "Missing file" })
  }
  const uploads = readUploads()
  const created = files.map((file) => {
    const record = {
      id: nanoid(12),
      sessionId,
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      consumed: false,
    }
    uploads.push(record)
    return record
  })
  writeUploads(uploads)
  res.json({ uploads: created })
})

app.get("/api/uploads/:sessionId", (req, res) => {
  const { sessionId } = req.params
  const uploads = readUploads().filter((item) => item.sessionId === sessionId && !item.consumed)
  res.json({ uploads })
})

app.post("/api/uploads/:id/consume", (req, res) => {
  const { id } = req.params
  const uploads = readUploads()
  const target = uploads.find((item) => item.id === id)
  if (!target) {
    return res.status(404).json({ error: "Upload not found" })
  }
  target.consumed = true
  writeUploads(uploads)
  res.json({ upload: target })
})

app.delete("/api/uploads/:id", (req, res) => {
  const { id } = req.params
  const uploads = readUploads()
  const next = uploads.filter((item) => item.id !== id)
  if (next.length === uploads.length) {
    return res.status(404).json({ error: "Upload not found" })
  }
  writeUploads(next)
  res.json({ status: "deleted" })
})

app.listen(PORT, () => {
  console.log(`Phone upload server listening on port ${PORT}`)
  console.log(`Uploads directory: ${uploadDir}`)
})
