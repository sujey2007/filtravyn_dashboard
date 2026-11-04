import { API_BASE } from '../config/device'
import type { Alert, Telemetry } from '../types/telemetry'

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
