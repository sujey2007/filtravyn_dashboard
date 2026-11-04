import { useTelemetry } from '../app/TelemetryContext'
import { PageHead, Pill } from '../components/ui'
import { clock, dateTime, TZ } from '../services/status'
import type { Thresholds } from '../config/device'

function NumField({ id, label, k, step = 1 }: { id: string; label: string; k: keyof Thresholds; step?: number }) {
  const { cfg, setCfg } = useTelemetry()
  return (
    <label className="fld" htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        step={step}
        value={cfg[k]}
        onChange={(e) => {
          if (e.target.value !== '') setCfg({ [k]: Number(e.target.value) } as Partial<Thresholds>)
        }}
      />
    </label>
  )
}

export function Alerts() {
  const { alerts, events } = useTelemetry()
  return (
    <>
      <PageHead title="Alerts and diagnostics">System health diagnostics, parameter thresholds, and TinyML neural network inference alerts.</PageHead>
      <div className="ov">
        <div className="panel">
          <div className="ph"><h2>Active alerts</h2></div>
          {alerts.length === 0 && <div className="empty">No active alerts.</div>}
          {alerts.map((a) => (
            <div className="alert" key={a.key}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pill kind={a.severity === 'critical' ? 'crit' : a.severity === 'warning' ? 'warn' : 'info'}>
                  {a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}
                </Pill>
                <h3>{a.title}</h3>
              </div>
              <dl>
                <dt>Detected</dt><dd>{a.detected}</dd>
                <dt>Triggered by</dt><dd className="num" style={{ fontSize: 13 }}>{a.trigger}</dd>
                <dt>Since</dt><dd className="num" style={{ fontSize: 13 }}>{dateTime(a.since)} {TZ}</dd>
                <dt>Basis</dt><dd>{a.basis === 'confirmed' ? 'Confirmed from reported data' : 'Possible cause only. Not confirmed'}</dd>
                <dt>Checks</dt><dd><ul>{a.checks.map((c) => <li key={c}>{c}</li>)}</ul></dd>
              </dl>
            </div>
          ))}
        </div>
        <div className="col">
          <div className="panel">
            <div className="ph"><h2>Thresholds</h2></div>
            <div className="bench" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <NumField id="c-stale" label="Stale after (s)" k="staleTimeoutS" />
              <NumField id="c-delay" label="Pump startup delay (s)" k="startupDelayS" />
              <NumField id="c-flowmin" label="Minimum flow (L/min)" k="flowMinLpm" step={0.05} />
              <NumField id="c-tds" label="TDS review above (ppm)" k="tdsWarnHigh" step={10} />
              <NumField id="c-tmin" label="Temperature low (°C)" k="tempMin" />
              <NumField id="c-tmax" label="Temperature high (°C)" k="tempMax" />
            </div>
            <p className="small muted" style={{ padding: '0 14px 14px' }}>
              All values are placeholders until calibrated. They prompt a review and are not safety limits.
            </p>
          </div>
          <div className="panel">
            <div className="ph"><h2>Event log</h2><span className="tagline">{TZ}</span></div>
            <div className="list" style={{ maxHeight: 340, overflow: 'auto' }}>
              {events.length === 0 && <div className="empty">No events yet.</div>}
              {events.slice(0, 30).map((e, i) => (
                <div className="li" key={e.t + '-' + i}>
                  <span className="t">{clock(e.t)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{e.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
