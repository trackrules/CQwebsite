import type { ParsedFilename, StartType } from "@/types/session"

const FILENAME_REGEX = /(?<date>\d{6})-(?<group>[^-]+)-(?<riders>[^-]+)-(?<startType>[^-]+)-(?<distance>\d+(?:\.\d+)?)-(?<rep>\d+)/i

const startTypeMap: Record<string, StartType> = {
  st: "ST",
  ft: "FT",
}

export function parseVideoFilename(fileName: string): ParsedFilename {
  const base = fileName.split(/[\\/]/).at(-1) ?? fileName
  const name = base.replace(/\.[^.]+$/, "")
  const match = FILENAME_REGEX.exec(name)

  if (!match?.groups) {
    return {
      date_iso: null,
      time_of_day: null,
      group: null,
      riders: [],
      start_type: null,
      distance: null,
      rep: null,
    }
  }

  const { date, group, riders, startType, distance, rep } = match.groups as Record<string, string>

  const year = Number.parseInt(date.slice(0, 2), 10)
  const month = date.slice(2, 4)
  const day = date.slice(4, 6)
  const dateIso = Number.isNaN(year) ? null : `20${date.slice(0, 2)}-${month}-${day}`

  const ridersList = riders
    .split(/[+_]/)
    .map((part) => part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const normalized = startType.trim().toLowerCase()
  const mapped = startTypeMap[normalized] ?? "Other"

  const groupName = group.replace(/_/g, " ")

  const distanceValue = Number.parseFloat(distance)
  const repValue = Number.parseInt(rep, 10)

  return {
    date_iso: dateIso,
    time_of_day: null,
    group: groupName,
    riders: ridersList,
    start_type: mapped,
    distance: Number.isFinite(distanceValue) ? distanceValue : null,
    rep: Number.isFinite(repValue) ? repValue : null,
  }
}
