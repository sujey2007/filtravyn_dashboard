import { COMPONENTS, type ComponentId } from '../data/components'
import type { Thresholds } from '../config/device'
import type { Alert, Mode, Telemetry } from '../types/telemetry'
import { tsOf } from '../types/telemetry'

export type StateKind = 'ok' | 'warn' | 'crit' | 'na'
export interface CompState {
  st: StateKind
  label: string
}

export const STATE_LABEL: Record<StateKind, string> = {
  ok: 'Normal',
  warn: 'Warning',
  crit: 'Fault',
  na: 'Unavailable',
}

const fv = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d))

/** Maps telemetry and alerts to a state per component. Unknown or missing data is "na", never "ok". */
export function componentStates(
  last: Telemetry | null,
  mode: Mode,
  alerts: Alert[],
  cfg: Thresholds,
  now: number,
): Record<ComponentId, CompState> {
  const out = {} as Record<ComponentId, CompState>
  if (!last) {
    COMPONENTS.forEach((c) => (out[c.id] = { st: 'na', label: 'No data' }))
    return out
  }
  const has = (k: string) => alerts.some((a) => a.key === k)
  const stale = (now - tsOf(last)) / 1000 > cfg.staleTimeoutS

  out.tank = { st: 'na', label: 'No sensor' }
  out.filter = { st: 'na', label: 'Not estimated' }
  out.outlet = { st: 'na', label: 'Not monitored' }

  out.pump =
    last.pump_state === 'fault'
      ? { st: 'crit', label: 'Fault' }
      : has('pump-no-flow') || has('flow-pump-off')
        ? { st: 'warn', label: 'Check flow' }
        : last.pump_state === 'unknown'
          ? { st: 'na', label: 'Unknown' }
          : { st: 'ok', label: last.pump_state === 'on' ? 'On' : 'Off' }

  out.flowSensor =
    last.sensor_status.flow === 'valid' && last.flow_lpm != null
      ? { st: 'ok', label: `${fv(last.flow_lpm, 2)} L/min` }
      : { st: 'warn', label: 'Unavailable' }

  const tdsOk = last.sensor_status.tds === 'valid'
  const tempOk = last.sensor_status.temperature === 'valid'
  out.cell = {
    st: tdsOk && tempOk && !has('tds-high') && !has('temp-range') ? 'ok' : 'warn',
    label: `${last.tds_ppm != null ? last.tds_ppm + ' ppm' : 'TDS —'} · ${last.temperature_c != null ? fv(last.temperature_c) + ' °C' : 'T —'}`,
  }

  if (stale) {
    ;(Object.keys(out) as ComponentId[]).forEach((id) => {
      if (out[id].st === 'ok' || out[id].st === 'warn') out[id] = { st: 'warn', label: 'Stale' }
    })
  }
  return out
}
