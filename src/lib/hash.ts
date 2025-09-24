export async function computeVideoKey(file: File): Promise<string> {
  const descriptor = `${file.name}:${file.size}:${file.lastModified}`
  const buffer = new TextEncoder().encode(descriptor)
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
