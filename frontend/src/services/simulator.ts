import { DEVICE } from '../config/device'
import type { SensorStatus, Telemetry } from '../types/telemetry'
import { calculatePhysicalTurbidity, predictWaterQuality } from './tinyML'

export type Dis = 'ok' | 'off' | 'bad'

export interface SimControls {
  pump: boolean
  flow: number
  pumpFault: boolean
  /** pump commanded on but no flow */
  blocked: boolean
  /** flow while pump commanded off */
  ghost: boolean
  tdsOffset: number
  tempOffset: number
  turbidityOffset: number
  frozen: boolean
  dis: { tds: Dis; temperature: Dis; flow: Dis; turbidity: Dis }
  pumpSince: number
}

export const defaultControls = (): SimControls => ({
  pump: true,
  flow: 1.2,
  pumpFault: false,
  blocked: false,
  ghost: false,
  tdsOffset: 0,
  tempOffset: 0,
  turbidityOffset: 0,
  frozen: false,
  dis: { tds: 'ok', temperature: 'ok', flow: 'ok', turbidity: 'ok' },
  pumpSince: Date.now() - 3600e3,
})

const rnd = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const baseTds = (t: number) =>
  238 + 16 * Math.sin(t / 21600e3) + 7 * Math.sin(t / 1.1e6) + (rnd(Math.floor(t / 60e3)) - 0.5) * 6

const baseTemp = (t: number) => {
  const d = new Date(t)
  const h = d.getHours() + d.getMinutes() / 60
  return 28.6 + 1.9 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + (rnd(Math.floor(t / 60e3) + 999) - 0.5) * 0.3
}

const baseTurbidity = (t: number) => {
  // Clean treated water baseline: 1.2 - 2.4 NTU
  return 1.8 + 0.4 * Math.sin(t / 14400e3) + (rnd(Math.floor(t / 60e3) + 555) - 0.5) * 0.25
}

function build(
  t: number,
  tds: number | null,
  temp: number | null,
  flow: number | null,
  turbidity: number | null,
  cmd: boolean,
  pumpState: Telemetry['pump_state'],
  st: { tds: SensorStatus; temperature: SensorStatus; flow: SensorStatus; turbidity: SensorStatus },
): Telemetry {
  const safeTds = tds == null ? null : Math.round(tds)
  const safeTemp = temp == null ? null : Math.round(temp * 10) / 10
  const safeFlow = flow == null ? null : Math.round(flow * 100) / 100
  const safeTurb = turbidity == null ? null : Math.max(0, Math.round(turbidity * 10) / 10)

  let physAdc: number | null = null
  let physV: number | null = null
  if (safeTurb != null) {
    const phys = calculatePhysicalTurbidity(safeTurb)
    physAdc = phys.rawAdc
    physV = phys.voltage
  }

  // Run TinyML Inference when inputs are available
  let tinymlOutput
  if (safeTds != null && safeTurb != null && safeTemp != null && safeFlow != null) {
    tinymlOutput = predictWaterQuality(safeTds, safeTurb, safeTemp, safeFlow)
  }

  return {
    device_id: DEVICE.deviceId,
    timestamp: new Date(t).toISOString(),
    mode: 'simulation',
    tds_ppm: safeTds,
    temperature_c: safeTemp,
    flow_lpm: safeFlow,
    turbidity_ntu: safeTurb,
    turbidity_raw: physAdc,
    turbidity_voltage: physV,
    pump_commanded: cmd,
    pump_state: pumpState,
    sensor_status: st,
    tinyml: tinymlOutput,
  }
}

/** One live sample driven by ESP32 sensors and bench parameters. */
export function simRow(t: number, s: SimControls): Telemetry {
  const st = { tds: 'valid', temperature: 'valid', flow: 'valid', turbidity: 'valid' } as {
    tds: SensorStatus
    temperature: SensorStatus
    flow: SensorStatus
    turbidity: SensorStatus
  }
  let tds: number | null = baseTds(t) + s.tdsOffset
  let temp: number | null = baseTemp(t) + s.tempOffset
  let turb: number | null = baseTurbidity(t) + s.turbidityOffset
  const elapsed = (t - s.pumpSince) / 1000
  const noise = (rnd(Math.floor(t / 1000)) - 0.5) * 0.05
  let flow: number | null
  if (s.pump && !s.blocked) flow = s.flow * Math.min(1, elapsed / 3) + noise
  else if (!s.pump && s.ghost) flow = 0.6 + noise
  else flow = 0
  flow = Math.max(0, flow)

  const apply = (k: 'tds' | 'temperature' | 'flow' | 'turbidity', v: number | null): number | null => {
    const d = s.dis[k]
    if (d !== 'ok') {
      st[k] = d === 'off' ? 'disconnected' : 'out_of_range'
      return null
    }
    return v
  }
  tds = apply('tds', tds)
  temp = apply('temperature', temp)
  flow = apply('flow', flow)
  turb = apply('turbidity', turb)

  const ps: Telemetry['pump_state'] = s.pump ? (s.pumpFault ? 'fault' : 'on') : 'off'
  return build(t, tds, temp, flow, turb, s.pump, ps, st)
}

const histPumpOn = (t: number) => rnd(Math.floor(t / (25 * 60e3)) + 7) < 0.5

/** Historical sample sequence. */
export function histRow(t: number): Telemetry {
  const on = histPumpOn(t)
  const f = on ? 1.15 + rnd(Math.floor(t / 5e3) + 3) * 0.2 : 0
  return build(t, baseTds(t), baseTemp(t), f, baseTurbidity(t), on, on ? 'on' : 'off', {
    tds: 'valid',
    temperature: 'valid',
    flow: 'valid',
    turbidity: 'valid',
  })
}

export function historyRows(fromMs: number, toMs: number, stepMs: number): Telemetry[] {
  const rows: Telemetry[] = []
  for (let t = Math.ceil(fromMs / stepMs) * stepMs; t < toMs; t += stepMs) rows.push(histRow(t))
  return rows
}
