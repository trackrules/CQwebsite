const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
const redirectUri = import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI
const scopeEnv = import.meta.env.VITE_GOOGLE_PHOTOS_SCOPES

const defaultScopes = ["https://www.googleapis.com/auth/photoslibrary.readonly"]
const scopes = scopeEnv ? scopeEnv.split(",").map((item) => item.trim()).filter(Boolean) : defaultScopes

if (!clientId || !redirectUri) {
  console.warn("Google OAuth env vars missing. Set VITE_GOOGLE_OAUTH_CLIENT_ID and VITE_GOOGLE_OAUTH_REDIRECT_URI.")
}

type AuthUrlOptions = {
  state?: string
  codeChallenge?: string
  prompt?: string
  accessType?: "online" | "offline"
}

export type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
  id_token?: string
}

export type PendingGoogleAuth = {
  codeVerifier: string
  state: string | null
  createdAt: number
}

export type StoredGoogleTokens = TokenResponse & { obtainedAt: number }

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

const STORAGE_PREFIX = "googlePhotos"
const PENDING_KEY = `${STORAGE_PREFIX}:pending`
const TOKENS_KEY = `${STORAGE_PREFIX}:tokens`
const PKCE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
const PENDING_TTL_MS = 5 * 60 * 1000

function ensureEnvVars() {
  if (!clientId || !redirectUri) {
    throw new Error("Google OAuth env vars missing")
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.sessionStorage
  } catch (error) {
    console.warn("Session storage unavailable", error)
    return null
  }
}

function generateRandomString(length = 64) {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    throw new Error("Crypto API unavailable in this environment")
  }
  const values = new Uint8Array(length)
  window.crypto.getRandomValues(values)
  let result = ""
  for (const value of values) {
    result += PKCE_CHARSET[value % PKCE_CHARSET.length]
  }
  return result
}

function base64UrlEncode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function deriveCodeChallenge(verifier: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("SubtleCrypto unavailable to compute code challenge")
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await window.crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(digest)
}

function maybeDecodeURIComponent(value: string | null): string | null {
  if (value === null) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function createGoogleAuthRequest(): Promise<PendingGoogleAuth & { url: string }> {
  ensureEnvVars()
  const codeVerifier = generateRandomString(96)
  const codeChallenge = await deriveCodeChallenge(codeVerifier)
  const state = generateRandomString(32)
  const url = getGoogleAuthUrl({ codeChallenge, state })
  return { url, codeVerifier, state, createdAt: Date.now() }
}

export function storePendingGoogleAuth(pending: PendingGoogleAuth & { url?: string }) {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  const payload: PendingGoogleAuth = {
    codeVerifier: pending.codeVerifier,
    state: pending.state,
    createdAt: pending.createdAt,
  }
  storage.setItem(PENDING_KEY, JSON.stringify(payload))
}

export function consumePendingGoogleAuth(): PendingGoogleAuth | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const raw = storage.getItem(PENDING_KEY)
  storage.removeItem(PENDING_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as PendingGoogleAuth
    if (Date.now() - parsed.createdAt > PENDING_TTL_MS) {
      return null
    }
    return parsed
  } catch (error) {
    console.warn("Failed to parse pending Google auth payload", error)
    return null
  }
}

export function storeGoogleTokens(tokens: TokenResponse) {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  const payload: StoredGoogleTokens = { ...tokens, obtainedAt: Date.now() }
  storage.setItem(TOKENS_KEY, JSON.stringify(payload))
}

export function getStoredGoogleTokens(): StoredGoogleTokens | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const raw = storage.getItem(TOKENS_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as StoredGoogleTokens
  } catch (error) {
    console.warn("Failed to parse stored Google tokens", error)
    return null
  }
}

export function clearStoredGoogleTokens() {
  const storage = getSessionStorage()
  storage?.removeItem(TOKENS_KEY)
}

export function getGoogleAuthUrl(options: AuthUrlOptions = {}) {
  ensureEnvVars()
  const { state, codeChallenge, prompt = "consent", accessType = "offline" } = options
  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: accessType,
    include_granted_scopes: "true",
    prompt,
  })

  if (state) {
    params.set("state", state)
  }

  if (codeChallenge) {
    params.set("code_challenge", codeChallenge)
    params.set("code_challenge_method", "S256")
  }

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  ensureEnvVars()
  if (!codeVerifier) {
    throw new Error("codeVerifier is required to exchange a code when using PKCE in the browser")
  }

  const body = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
  })

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to exchange code: ${response.status} ${maybeDecodeURIComponent(errorText)}`)
  }

  return (await response.json()) as TokenResponse
}
