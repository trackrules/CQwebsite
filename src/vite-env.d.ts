/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID: string
  readonly VITE_GOOGLE_OAUTH_REDIRECT_URI: string
  readonly VITE_GOOGLE_PHOTOS_SCOPES?: string
  readonly VITE_GOOGLE_PHOTOS_ALBUM_ID?: string
  readonly VITE_UPLOAD_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
