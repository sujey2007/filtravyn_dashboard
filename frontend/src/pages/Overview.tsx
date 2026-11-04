import { Link } from 'react-router-dom'
import { useTelemetry } from '../app/TelemetryContext'
import { ComponentChips, ComponentInfo, PageHead, Pill, ReadingCard } from '../components/ui'
import { ScenarioBench } from '../components/ScenarioBench'
import { TwinStage } from '../features/digital-twin/TwinStage'
import { clock, fmt, sensorPill, TZ } from '../services/status'
import { DEVICE } from '../config/device'

export function Overview() {
  const { mode, last, cfg, alerts, events, volumeL, states, selected, select } = useTelemetry()
  const src = mode === 'simulation' ? 'ESP32-S3' : 'Live Ingest'
  const noData = !last

  const tds = sensorPill('tds', last, cfg)
  const temp = sensorPill('temperature', last, cfg)
  const flow = sensorPill('flow', last, cfg)
  const turb = sensorPill('turbidity', last, cfg)
  const ps = last?.pump_state
  const tinyml = last?.tinyml

  const classColor =
    tinyml?.predictedClass === 'Good'
      ? { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', dot: '#177A4E', pill: 'ok' as const }
      : tinyml?.predictedClass === 'Moderate'
      ? { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', dot: '#94590A', pill: 'warn' as const }
      : { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-300', dot: '#B52A25', pill: 'crit' as const }

  return (
    <>
      <PageHead title="Overview">
        Water path, sensor telemetry, and ESP32-S3 TinyML edge inference for <span className="num">{DEVICE.deviceId}</span>.
      </PageHead>

      <div className="ov">
        <div className="panel">
          <div className="ph">
            <h2>Water path</h2>
            <span className="tagline">Drag to orbit, scroll to zoom, click a component</span>
          </div>
          <TwinStage />
          <ComponentChips states={states} selected={selected} onSelect={select} />
          <ComponentInfo id={selected} state={states[selected]} />
        </div>

        <div className="col">
          <div className="cards">
            <ReadingCard
              label="TDS"
              value={noData ? 'No live data' : last.tds_ppm == null ? 'Unavailable' : String(last.tds_ppm)}
              unit={noData || last.tds_ppm == null ? undefined : 'ppm'}
              pill={tds}
              note={noData ? '' : src}
            />
            <ReadingCard
              label="Turbidity"
              value={noData ? 'No live data' : last.turbidity_ntu == null ? 'Unavailable' : fmt(last.turbidity_ntu, 1)}
              unit={noData || last.turbidity_ntu == null ? undefined : 'NTU'}
              pill={turb}
              note={noData ? '' : last.turbidity_raw != null ? `Pin 6 · ${last.turbidity_raw} ADC (${last.turbidity_voltage?.toFixed(2)} V)` : src}
            />
            <ReadingCard
              label="Water temperature"
              value={noData ? 'No live data' : last.temperature_c == null ? 'Unavailable' : fmt(last.temperature_c)}
              unit={noData || last.temperature_c == null ? undefined : '°C'}
              pill={temp}
              note={noData ? '' : src}
            />
            <ReadingCard
              label="Flow rate"
              value={noData ? 'No live data' : last.flow_lpm == null ? 'Unavailable' : fmt(last.flow_lpm, 2)}
              unit={noData || last.flow_lpm == null ? undefined : 'L/min'}
              pill={flow}
              note={noData ? '' : src}
            />
            <ReadingCard
              label="Pump state"
              value={noData ? 'No live data' : ps === 'fault' ? 'Fault' : ps === 'on' ? 'On' : ps === 'off' ? 'Off' : 'Unknown'}
              pill={noData ? ['na', 'No data'] : ps === 'fault' ? ['crit', 'Fault'] : ps === 'unknown' ? ['na', 'Unknown'] : ['ok', ps === 'on' ? 'On' : 'Off']}
              note={noData ? '' : `${src} · commanded ${last.pump_commanded ? 'on' : 'off'}`}
            />
            <ReadingCard
              label="Total volume"
              value={noData ? 'No live data' : volumeL.toFixed(2)}
              unit={noData ? undefined : 'L'}
              pill={noData ? ['na', 'No data'] : ['info', 'Calculated']}
              note={noData ? '' : `${src} · since telemetry start`}
            />
          </div>
          <p className="tagline">
            Telemetry readings from ESP32-S3 sensor cluster (TDS probe, turbidity optical ADC, DS18B20 temp, Hall flow turbine).
          </p>
        </div>
      </div>

      {/* TinyML Edge Water Quality Classifier Panel */}
      <div className="panel" style={{ marginTop: 4 }}>
        <div className="ph" style={{ borderBottom: '1px solid var(--line2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2>TinyML Water Quality Classifier</h2>
            <Pill kind="info">ESP32-S3 Edge Neural Network</Pill>
          </div>
          <span className="tagline">Architecture: 4 → 16 → 8 → 3 (Dense-ReLU-Softmax) · Latency: 1.2 ms</span>
        </div>
        <div className="pb" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(280px, 2fr)', gap: 20 }}>
          {/* Classification result */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--sheet)', borderRadius: 4, border: '1px solid var(--line2)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Edge Predicted Quality
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Pill kind={classColor.pill}>
                <span style={{ fontSize: 16, padding: '2px 4px' }}>{tinyml ? tinyml.predictedClass : 'Evaluating'}</span>
              </Pill>
              <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                {tinyml ? tinyml.probabilitiesPct[tinyml.predictedClass] : '—'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.4 }}>
              {tinyml?.predictedClass === 'Good'
                ? 'High clarity, optimal mineral balance, and nominal flow. Safe for direct drinking.'
                : tinyml?.predictedClass === 'Moderate'
                ? 'Acceptable filtration quality with minor baseline variance. Monitoring continuous performance.'
                : 'Elevated TDS or turbidity detected. Membrane review recommended.'}
            </p>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, fontSize: 12, color: 'var(--ink2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>Inference Engine: <b>Native C++</b></div>
              <div>Firmware: <b>filtravyn_model.h</b></div>
              <div>Hardware: <b>ESP32-S3</b></div>
              <div>Frequency: <b>240 MHz</b></div>
            </div>
          </div>

          {/* Probability Distribution */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Class Probability Distribution
            </span>

            {/* Good */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#177A4E' }}>Good</span>
                <span className="num" style={{ fontWeight: 700 }}>{tinyml ? tinyml.probabilitiesPct.Good : '0%'}</span>
              </div>
              <div style={{ height: 10, background: 'var(--sheet)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line2)' }}>
                <div style={{ height: '100%', width: tinyml ? `${tinyml.probabilities.Good * 100}%` : '0%', background: '#177A4E', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Moderate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#94590A' }}>Moderate</span>
                <span className="num" style={{ fontWeight: 700 }}>{tinyml ? tinyml.probabilitiesPct.Moderate : '0%'}</span>
              </div>
              <div style={{ height: 10, background: 'var(--sheet)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line2)' }}>
                <div style={{ height: '100%', width: tinyml ? `${tinyml.probabilities.Moderate * 100}%` : '0%', background: '#94590A', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Poor */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#B52A25' }}>Poor</span>
                <span className="num" style={{ fontWeight: 700 }}>{tinyml ? tinyml.probabilitiesPct.Poor : '0%'}</span>
              </div>
              <div style={{ height: 10, background: 'var(--sheet)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line2)' }}>
                <div style={{ height: '100%', width: tinyml ? `${tinyml.probabilities.Poor * 100}%` : '0%', background: '#B52A25', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--ink2)', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
              <span>TDS: <b className="num">{last?.tds_ppm ?? '—'} ppm</b></span>
              <span>Turbidity: <b className="num">{last?.turbidity_ntu ?? '—'} NTU</b></span>
              <span>Temp: <b className="num">{last?.temperature_c ?? '—'} °C</b></span>
              <span>Flow: <b className="num">{last?.flow_lpm ?? '—'} L/min</b></span>
            </div>
          </div>
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <div className="ph">
            <h2>Active alerts & diagnostics</h2>
            <Link to="/alerts" className="small">Open diagnostics</Link>
          </div>
          <div className="list">
            {alerts.length === 0 && <div className="empty">All parameters nominal. No active alerts.</div>}
            {alerts.slice(0, 4).map((a) => (
              <div className="li" key={a.key}>
                <Pill kind={a.severity === 'critical' ? 'crit' : a.severity === 'warning' ? 'warn' : 'info'}>
                  {a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}
                </Pill>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.title}</b>
                  <div className="small muted">{a.detected}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="ph">
            <h2>Recent device events</h2>
            <span className="tagline">Times in {TZ}</span>
          </div>
          <div className="list">
            {events.length === 0 && <div className="empty">No events logged yet.</div>}
            {events.slice(0, 7).map((e, i) => (
              <div className="li" key={e.t + '-' + i}>
                <span className="t">{clock(e.t)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ph">
          <h2>ESP32 Sensor Bench & Parameter Controls</h2>
          <span className="tagline">Adjust input setpoints and observe live TinyML neural network reclassification in real time.</span>
        </div>
        <ScenarioBench />
      </div>
    </>
  )
}
