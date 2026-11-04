import type { Thresholds } from '../config/device'
import type { Alert, Mode, Telemetry } from '../types/telemetry'
import { tsOf } from '../types/telemetry'

export type RawAlert = Omit<Alert, 'since'>

export interface DiagInput {
  /** newest last */
  recent: Telemetry[]
  mode: Mode
  /** Set when Live Device Mode cannot reach the backend. */
  liveError: string | null
  now: number
  cfg: Thresholds
}

const fv = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d))
const clock = (t: number) => new Date(t).toLocaleTimeString()

export const turbidityInfo = (): RawAlert => ({
  key: 'turbidity-absent',
  severity: 'info',
  title: 'Turbidity sensor uncalibrated',
  detected: 'Turbidity baseline is initializing.',
  trigger: 'sensor_status.turbidity = not_installed',
  basis: 'confirmed',
  checks: [
    'Check physical sensor pin (ESP32-S3 Pin 6).',
    'Verify ADC readings are within normal threshold.',
  ],
})

/** When the pump command last switched on, searching back through contiguous "on" records. */
export function pumpOnSince(recent: Telemetry[]): number | null {
  let since: number | null = null
  for (let i = recent.length - 1; i >= 0; i--) {
    if (!recent[i].pump_commanded) break
    since = tsOf(recent[i])
  }
  return since
}

export function evaluate({ recent, mode, liveError, now, cfg }: DiagInput): RawAlert[] {
  const out: RawAlert[] = []
  const last = recent.length ? recent[recent.length - 1] : null

  if (!last) {
    if (mode === 'live') {
      out.push({
        key: 'no-live-data',
        severity: 'warning',
        title: 'Awaiting device stream',
        detected: liveError
          ? `The backend connection reported: ${liveError}.`
          : 'Waiting for telemetry transmission from ESP32-S3.',
        trigger: 'Awaiting telemetry packet',
        basis: 'confirmed',
        checks: [
          'Confirm the ESP32-S3 is powered and running firmware.',
          'Verify Wi-Fi credentials and connection to ingest endpoint.',
          'Review serial monitor output at 115200 baud.',
        ],
      })
    }
    return out
  }

  const lastT = tsOf(last)
  const age = (now - lastT) / 1000
  const stale = age > cfg.staleTimeoutS

  if (stale) {
    const offline = age > cfg.staleTimeoutS * 4
    out.push({
      key: 'stale',
      severity: offline ? 'critical' : 'warning',
      title: offline ? 'ESP32-S3 offline' : 'Telemetry delayed',
      detected: `No new telemetry for ${Math.round(age)} s (timeout ${cfg.staleTimeoutS} s).`,
      trigger: `Last transmission at ${clock(lastT)}`,
      basis: 'confirmed',
      checks: [
        'Check ESP32-S3 power and Wi-Fi signal.',
        'Verify broker or ingest endpoint connectivity.',
        'Check device serial diagnostics.',
      ],
    })
  } else {
    const names = { tds: 'TDS', temperature: 'Temperature', flow: 'Flow', turbidity: 'Turbidity' } as const
    ;(['tds', 'temperature', 'flow', 'turbidity'] as const).forEach((k) => {
      const st = last.sensor_status[k]
      if (st && st !== 'valid' && st !== 'not_installed') {
        out.push({
          key: `sensor-${k}`,
          severity: 'warning',
          title: `${names[k]} sensor ${st === 'disconnected' ? 'disconnected' : 'reading out of range'}`,
          detected: `Sensor reported state "${st}".`,
          trigger: `sensor_status.${k}`,
          basis: 'confirmed',
          checks: [
            'Check sensor wiring and probe contacts.',
            'Confirm sensor submersion in water flow path.',
            'Verify supply voltage.',
          ],
        })
      }
    })

    const flowOk = last.sensor_status.flow === 'valid' && last.flow_lpm != null
    const onSince = pumpOnSince(recent)
    const onFor = onSince == null ? 0 : (now - onSince) / 1000

    if (flowOk && last.pump_commanded && onFor > cfg.startupDelayS && (last.flow_lpm as number) < cfg.flowMinLpm) {
      out.push({
        key: 'pump-no-flow',
        severity: 'warning',
        title: 'Pump running with no flow',
        detected: `Pump active for ${Math.round(onFor)} s but flow is ${fv(last.flow_lpm, 2)} L/min.`,
        trigger: `pump_commanded = true and flow_lpm < ${cfg.flowMinLpm}`,
        basis: 'possible',
        checks: [
          'Check water reservoir and pump priming.',
          'Inspect tubing for blockages or kinked lines.',
          'Verify flow sensor turbine rotation.',
        ],
      })
    }
    if (flowOk && !last.pump_commanded && (last.flow_lpm as number) >= cfg.flowMinLpm) {
      out.push({
        key: 'flow-pump-off',
        severity: 'warning',
        title: 'Flow detected while pump is idle',
        detected: `Flow reads ${fv(last.flow_lpm, 2)} L/min while pump is off.`,
        trigger: `pump_commanded = false and flow_lpm >= ${cfg.flowMinLpm}`,
        basis: 'possible',
        checks: [
          'Check for gravity flow or siphoning.',
          'Check relay cutoff status.',
        ],
      })
    }
    if (last.pump_state === 'fault') {
      out.push({
        key: 'pump-fault',
        severity: 'critical',
        title: 'Pump hardware fault',
        detected: 'Device reports pump_state = fault.',
        trigger: 'pump_state = fault',
        basis: 'confirmed',
        checks: [
          'Isolate 24V supply before inspecting.',
          'Check relay and diaphragm pump motor current.',
        ],
      })
    }
    if (last.tds_ppm != null && last.tds_ppm > cfg.tdsWarnHigh) {
      out.push({
        key: 'tds-high',
        severity: 'warning',
        title: 'TDS elevated above baseline threshold',
        detected: `TDS reads ${last.tds_ppm} ppm, above ${cfg.tdsWarnHigh} ppm target limit.`,
        trigger: 'tds_ppm > threshold',
        basis: 'confirmed',
        checks: [
          'Inspect RO membrane and carbon pre-filters.',
          'Verify TDS calibration with buffer solution.',
        ],
      })
    }
    if (last.turbidity_ntu != null && last.turbidity_ntu > 5.0) {
      out.push({
        key: 'turbidity-high',
        severity: 'warning',
        title: 'Elevated Turbidity',
        detected: `Turbidity reads ${fv(last.turbidity_ntu, 1)} NTU (standard limit is 5.0 NTU).`,
        trigger: 'turbidity_ntu > 5.0',
        basis: 'confirmed',
        checks: [
          'Inspect sediment pre-filter cartridge.',
          'Check raw water clarity and ESP32 Pin 6 ADC voltage.',
        ],
      })
    }
    if (last.tinyml && last.tinyml.predictedClass === 'Poor') {
      out.push({
        key: 'tinyml-water-quality-poor',
        severity: 'critical',
        title: 'TinyML Edge Alert: Poor Water Quality Detected',
        detected: `ESP32-S3 neural network classified water quality as Poor with ${last.tinyml.probabilitiesPct.Poor} confidence.`,
        trigger: 'TinyML inference = Poor',
        basis: 'confirmed',
        checks: [
          'Combined TDS, turbidity, temperature, and flow parameters indicate degraded water quality.',
          'Service filter cartridges and test membrane rejection rate.',
        ],
      })
    }
    if (last.temperature_c != null && (last.temperature_c > cfg.tempMax || last.temperature_c < cfg.tempMin)) {
      out.push({
        key: 'temp-range',
        severity: 'warning',
        title: 'Temperature outside target range',
        detected: `Water temperature is ${fv(last.temperature_c)} °C.`,
        trigger: 'temperature_c',
        basis: 'confirmed',
        checks: ['Check thermal probe placement.'],
      })
    }
  }

  if (last.sensor_status.turbidity === 'not_installed') {
    out.push(turbidityInfo())
  }

  const order = { critical: 0, warning: 1, info: 2 } as const
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}
