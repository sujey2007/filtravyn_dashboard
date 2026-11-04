import type { Thresholds } from '../config/device'
import type { Telemetry } from '../types/telemetry'

export type PillKind = 'ok' | 'warn' | 'crit' | 'na' | 'info'

/** Validity pill for one sensor. Missing data is "No data", never "Valid". */
export function sensorPill(
  key: 'tds' | 'temperature' | 'flow' | 'turbidity',
  r: Telemetry | null,
  cfg: Thresholds,
): [PillKind, string] {
  if (!r) return ['na', 'No data']
  const st = r.sensor_status[key]
  if (st === 'disconnected') return ['warn', 'Disconnected']
  if (st === 'out_of_range') return ['warn', 'Invalid reading']
  if (st === 'not_installed') return ['na', 'Awaiting sensor']
  if (st === 'unknown') return ['na', 'Unknown']
  if (key === 'tds' && r.tds_ppm != null && r.tds_ppm > cfg.tdsWarnHigh) return ['warn', 'Above threshold']
  if (key === 'turbidity' && r.turbidity_ntu != null && r.turbidity_ntu > 5.0) return ['warn', 'Elevated NTU']
  if (key === 'temperature' && r.temperature_c != null && (r.temperature_c > cfg.tempMax || r.temperature_c < cfg.tempMin))
    return ['warn', 'Out of range']
  return ['ok', 'Valid']
}

export const fmt = (v: number | null, d = 1): string => (v == null ? '—' : v.toFixed(d))
export const pad = (n: number) => String(n).padStart(2, '0')
export const clock = (t: number) => {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
export const dateTime = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${clock(t)}`
}
export const TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  } catch {
    return 'local'
  }
})()
