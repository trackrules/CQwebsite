import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App.tsx"
import { PhoneUploadPage } from "@/pages/PhoneUploadPage"

import "./index.css"

const isPhoneUploadRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/phone-upload")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isPhoneUploadRoute ? <PhoneUploadPage /> : <App />}
  </StrictMode>,
)
