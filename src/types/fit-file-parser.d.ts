declare module "fit-file-parser" {
  export interface FitParserOptions {
    force?: boolean
    speedUnit?: "m/s" | "km/h" | "mi/h"
    lengthUnit?: "m" | "km" | "mi"
    temperatureUnit?: "celcius" | "celsius" | "fahrenheit"
    elapsedRecordField?: boolean
    mode?: "cascade" | "list"
  }

  export type FitPrimitive = number | string | boolean | null | undefined | Date

  export interface FitRecord {
    timestamp?: Date | string | number
    distance?: number
    speed?: number
    heart_rate?: number
    cadence?: number
    power?: number
    [key: string]: unknown
  }

  export interface FitSession {
    start_time?: Date | string | number
    [key: string]: FitPrimitive | FitPrimitive[] | Record<string, FitPrimitive>
  }

  export interface FitFile {
    records?: FitRecord[]
    sessions?: FitSession[]
    laps?: unknown[]
    events?: unknown[]
    [key: string]: unknown
  }

  export default class FitParser {
    constructor(options?: FitParserOptions)
    parse(data: ArrayBuffer, callback: (error: unknown, result: FitFile) => void): void
  }
}
