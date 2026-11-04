import type { Telemetry } from '../types/telemetry'

export const CSV_HEADER =
  'device_id,timestamp,mode,tds_ppm,temperature_c,flow_lpm,turbidity_ntu,turbidity_raw_adc,turbidity_voltage,tinyml_quality,pump_commanded,pump_state,tds_status,temperature_status,flow_status,turbidity_status'

const cell = (v: number | null | undefined) => (v == null ? '' : String(v))

/** Timestamped records for ML analysis and verification. */
export function toCsv(rows: Telemetry[]): string {
  const lines = rows.map((r) =>
    [
      r.device_id,
      r.timestamp,
      r.mode,
      cell(r.tds_ppm),
      cell(r.temperature_c),
      cell(r.flow_lpm),
      cell(r.turbidity_ntu),
      cell(r.turbidity_raw),
      cell(r.turbidity_voltage),
      r.tinyml?.predictedClass ?? '',
      r.pump_commanded,
      r.pump_state,
      r.sensor_status.tds,
      r.sensor_status.temperature,
      r.sensor_status.flow,
      r.sensor_status.turbidity,
    ].join(','),
  )
  return [CSV_HEADER, ...lines].join('\n')
}

/** Triggers a browser download. Falls back to false where downloads are blocked. */
export function downloadCsv(text: string, name: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
