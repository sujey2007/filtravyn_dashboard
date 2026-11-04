import { API_BASE } from '../config/device'
import type { Alert, SensorStatuses, Telemetry } from '../types/telemetry'

// Thin REST client. Components never call fetch directly.

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export interface DeviceInfo {
  device_id: string
  connection: 'online' | 'stale' | 'offline' | 'unknown'
  last_seen: string | null
  firmware: string | null
}

/** Backend alerts are stateless, so `since` is always null. The dashboard tracks first-seen time itself. */
export type ServerAlert = Omit<Alert, 'since'> & { since: null }

export interface ModelConfig {
  asset: string | null
  mapping: Record<string, string[]>
  pipeRoute: string[] | null
}

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

export interface ChatTelemetry {
  mode: 'simulation' | 'live'
  tds_ppm: number | null
  temperature_c: number | null
  flow_lpm: number | null
  turbidity_ntu: number | null
  pump_state: Telemetry['pump_state']
  sensor_status: SensorStatuses
}

export const api = {
  health: () => get<{ status: string }>('/health'),
  device: () => get<DeviceInfo>('/device'),
  /** Returns null when the backend has no telemetry yet (HTTP 404). */
  async latest(signal?: AbortSignal): Promise<Telemetry | null> {
    const res = await fetch(`${API_BASE}/readings/latest`, { signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as Telemetry
  },
  readings: (fromIso: string, toIso: string, limit = 5000, signal?: AbortSignal) =>
    get<Telemetry[]>(`/readings?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=${limit}`, signal),
  alerts: () => get<ServerAlert[]>('/alerts'),
  modelConfig: () => get<ModelConfig>('/model/config'),
  async chat(messages: ChatMessage[], telemetry: ChatTelemetry): Promise<string> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, telemetry }),
    })
    let result: { reply?: string; detail?: string }
    try {
      result = (await res.json()) as { reply?: string; detail?: string }
    } catch {
      throw new Error('The assistant service returned an invalid response.')
    }
    if (!res.ok) throw new Error(result.detail ?? `${res.status} ${res.statusText}`)
    if (!result.reply) throw new Error('The assistant returned an empty response.')
    return result.reply
  },
}

/** Static fallback so the Digital Twin works with no backend. Edit public/models/model.config.json. */
export async function loadModelConfig(): Promise<ModelConfig> {
  try {
    const res = await fetch('/models/model.config.json')
    if (res.ok) return (await res.json()) as ModelConfig
  } catch {
    /* fall through */
  }
  return { asset: null, mapping: {}, pipeRoute: null }
}
