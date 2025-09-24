import { openDB } from "idb"
import type { Session } from "@/types/session"

const DB_NAME = "cycling-annotator"
const STORE_SESSIONS = "sessions"
const DB_VERSION = 1

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
      db.createObjectStore(STORE_SESSIONS, { keyPath: "videoKey" })
    }
  },
})

export async function getAllSessions(): Promise<Session[]> {
  const db = await dbPromise
  return (await db.getAll(STORE_SESSIONS)) as Session[]
}

export async function getSession(videoKey: string): Promise<Session | undefined> {
  const db = await dbPromise
  return (await db.get(STORE_SESSIONS, videoKey)) as Session | undefined
}

export async function saveSession(session: Session): Promise<void> {
  const db = await dbPromise
  await db.put(STORE_SESSIONS, session)
}

export async function deleteSession(videoKey: string): Promise<void> {
  const db = await dbPromise
  await db.delete(STORE_SESSIONS, videoKey)
}

export async function exportSessions(): Promise<string> {
  const sessions = await getAllSessions()
  return JSON.stringify({ version: 1, sessions }, null, 2)
}

export async function importSessions(json: string): Promise<number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error("Invalid JSON file")
  }

  if (!parsed || typeof parsed !== "object" || !("sessions" in parsed)) {
    throw new Error("Unexpected sessions file structure")
  }

  const list = (parsed as { sessions: Session[] }).sessions
  if (!Array.isArray(list)) {
    throw new Error("Sessions payload is not an array")
  }

  const db = await dbPromise
  const tx = db.transaction(STORE_SESSIONS, "readwrite")
  for (const session of list) {
    await tx.store.put(session)
  }
  await tx.done
  return list.length
}
