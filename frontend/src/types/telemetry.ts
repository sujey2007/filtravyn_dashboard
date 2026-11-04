import type { TinyMLPrediction } from '../services/tinyML'

export type Mode = 'simulation' | 'live'
export type SensorStatus = 'valid' | 'disconnected' | 'out_of_range' | 'not_installed' | 'unknown'
export type PumpState = 'on' | 'off' | 'fault' | 'unknown'

export interface SensorStatuses {
  tds: SensorStatus
  temperature: SensorStatus
  flow: SensorStatus
  turbidity: SensorStatus
}

export interface Telemetry {
  device_id: string
  /** ISO 8601, UTC */
  timestamp: string
  mode: Mode
  /** ppm. null = unavailable (never zero as a substitute) */
  tds_ppm: number | null
  /** °C */
  temperature_c: number | null
  /** L/min */
  flow_lpm: number | null
  /** NTU */
  turbidity_ntu: number | null
  /** ESP32-S3 Physical ADC (Pin 6) */
  turbidity_raw?: number | null
  /** ESP32-S3 Physical Sensor Voltage in Volts */
  turbidity_voltage?: number | null
  pump_commanded: boolean
  pump_state: PumpState
  sensor_status: SensorStatuses
  /** Native TinyML classification output from ESP32-S3 neural network */
  tinyml?: TinyMLPrediction
}

export type Severity = 'info' | 'warning' | 'critical'

export interface Alert {
  key: string
  severity: Severity
  title: string
  detected: string
  trigger: string
  /** confirmed = read straight from reported data; possible = a candidate cause only */
  basis: 'confirmed' | 'possible'
  checks: string[]
  /** epoch ms when the alert first appeared */
  since: number
}

export interface EventItem {
  t: number
  text: string
  kind: Severity | 'ok'
}

/** How a value was obtained. Shown next to every figure. */
export type Provenance = 'measured' | 'simulated' | 'calculated' | 'estimated'

export type RangeKey = '1h' | '24h' | '7d' | '30d'

export const tsOf = (r: Telemetry): number => Date.parse(r.timestamp)
