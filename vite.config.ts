import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ command }) => {
  const isBuild = command === "build"
  const base = isBuild ? process.env.VITE_PUBLIC_BASE_PATH ?? "./" : "/"

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    test: {
      environment: "node",
      globals: true,
      setupFiles: ["./src/setupTests.ts"],
      css: true,
    },
  }
})
