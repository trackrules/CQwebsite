import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSeconds(seconds: number | null | undefined, decimals = 2): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "--.--"
  }
  const sign = seconds < 0 ? "-" : ""
  const total = Math.abs(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  if (minutes === 0) {
    return `${sign}${secs.toFixed(decimals).padStart(decimals + 3, "0")}`
  }
  return `${sign}${minutes}:${secs.toFixed(decimals).padStart(decimals + 3, "0")}`
}

export function parseTimeInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const match = trimmed.match(/^(?<sign>[-+])?(?<body>[0-9:.]+)$/)
  if (!match?.groups) {
    return null
  }
  const sign = match.groups.sign === "-" ? -1 : 1
  const parts = match.groups.body.split(":")
  const numeric = parts.reduce((acc, part) => acc * 60 + Number(part), 0)
  if (!Number.isFinite(numeric)) {
    return null
  }
  return sign * numeric
}

export function distanceToLabel(distance: number): string {
  const rounded = Number(distance.toFixed(3))
  if (Number.isInteger(rounded)) {
    return rounded.toString()
  }
  return rounded.toString().replace(/\.\d*?0+$/, (value) => value.replace(/0+$/, "")).replace(/\.$/, "")
}

export function roundTo(value: number, decimals = 3) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
