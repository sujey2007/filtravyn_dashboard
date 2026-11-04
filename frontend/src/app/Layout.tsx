import { NavLink, Outlet } from 'react-router-dom'
import { useTelemetry } from './TelemetryContext'
import { ChatWidget } from '../components/ChatWidget'
import { DEVICE } from '../config/device'
import { clock, TZ } from '../services/status'
import { tsOf } from '../types/telemetry'

const NAV: [string, string][] = [
  ['/', 'Overview'],
  ['/twin', 'Digital twin'],
  ['/analytics', 'Sensor analytics'],
  ['/alerts', 'Alerts and diagnostics'],
  ['/support', 'Support and DIY'],
]

export function Layout() {
  const { mode, setMode, last, alerts, liveError } = useTelemetry()
  const stale = alerts.some((a) => a.key === 'stale')
  const conn =
    mode === 'simulation'
      ? stale ? 'ESP32-S3 (Telemetry delayed)' : 'ESP32-S3 Connected'
      : last ? (stale ? 'Server Bridge (delayed)' : 'Server Bridge Connected') : liveError ? 'Bridge unreachable' : 'Awaiting data'

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          FiltraVyn<small>Water purifier console</small>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="dev">
          <span>Device</span>
          <b>{DEVICE.deviceId}</b>
          <span>Telemetry Link</span>
          <b>{conn}</b>
          <span>TinyML Engine</span>
          <b>ESP32-S3 Native C++</b>
          <span>Last transmission ({TZ})</span>
          <b>{last ? clock(tsOf(last)) : '—'}</b>
        </div>
        <div>
          <div className="tagline" style={{ marginBottom: 6 }}>Telemetry source</div>
          <div className="seg" role="group" aria-label="Telemetry source">
            <button aria-pressed={mode === 'simulation'} onClick={() => setMode('simulation')}>ESP32-S3 Stream</button>
            <button aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Server Bridge</button>
          </div>
        </div>
        <div className="rail-foot">
          FiltraVyn ESP32-S3 Dual-Core Xtensa LX7 @ 240MHz. TinyML Neural Network (4 → 16 → 8 → 3) continuous water quality classification.
        </div>
      </aside>
      <main className="main">
        <Banner />
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  )
}

function Banner() {
  const { last } = useTelemetry()
  if (!last) return null
  return (
    <div className="banner sim" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', color: '#166534' }}>
      <strong>ESP32-S3 Telemetry Active:</strong>
      <span>Receiving live sensor stream (TDS, Pin 6 ADC Turbidity, Temperature, Flow) with on-device TinyML inference.</span>
    </div>
  )
}
