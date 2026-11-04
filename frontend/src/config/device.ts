// Device-specific settings. Every value here is a PLACEHOLDER until calibrated or verified on the real hardware.
// Do not hardcode GPIO pins, K-factors or TDS conversion constants anywhere else.

export interface Thresholds {
  /** Telemetry older than this is flagged stale (s). */
  staleTimeoutS: number
  /** Time after the pump is commanded on before missing flow is flagged (s). */
  startupDelayS: number
  /** Flow below this counts as "no flow" (L/min). */
  flowMinLpm: number
  /** TDS above this prompts a review. It is not a drinking-water judgement (ppm). */
  tdsWarnHigh: number
  turbidityWarnHigh: number
  tempMin: number
  tempMax: number
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  staleTimeoutS: 15,
  startupDelayS: 10,
  flowMinLpm: 0.2,
  tdsWarnHigh: 500,
  turbidityWarnHigh: 5.0,
  tempMin: 5,
  tempMax: 40,
}

export const DEVICE = {
  deviceId: 'filtravyn-001',
  /** Plausible ranges used to reject impossible readings. */
  tdsRange: [0, 1000] as const,
  turbidityRange: [0, 20] as const,
  temperatureRange: [-10, 85] as const,
  flowRange: [0, 6] as const,
  /** Pulses per litre for the flow sensor. null until calibrated. */
  flowKFactor: null as number | null,
  /** Pump label values (not measured). */
  pumpLabel: { voltage: 24, currentA: 0.33, flowLpm: 1.6 },
}

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/api'
export const LIVE_POLL_MS: number = Number(import.meta.env.VITE_LIVE_POLL_MS ?? 2000)
