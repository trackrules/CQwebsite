import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App.tsx"
import { PhoneUploadPage } from "@/pages/PhoneUploadPage"

import "./index.css"

const isPhoneUploadRoute =
  typeof window !== "undefined" && /(^|\/)phone-upload(\/|$)/.test(window.location.pathname)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isPhoneUploadRoute ? <PhoneUploadPage /> : <App />}
  </StrictMode>,
)
