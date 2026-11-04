import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_THRESHOLDS, LIVE_POLL_MS, type Thresholds } from '../config/device'
import { evaluate } from '../services/diagnostics'
import { api } from '../services/api'
import { defaultControls, simRow, type SimControls } from '../services/simulator'
import type { Alert, EventItem, Mode, Telemetry } from '../types/telemetry'
import { tsOf } from '../types/telemetry'
import { componentStates, type CompState } from '../services/componentState'
import type { ComponentId } from '../data/components'

// Owns the data source. Simulation and Live Device data never mix:
// switching modes clears the buffer, and Live Mode never falls back to generated values.

interface Ctx {
  mode: Mode
  setMode: (m: Mode) => void
  controls: SimControls
  patchControls: (p: Partial<SimControls>) => void
  resetControls: () => void
  last: Telemetry | null
  recent: Telemetry[]
  alerts: Alert[]
  events: EventItem[]
  volumeL: number
  cfg: Thresholds
  setCfg: (p: Partial<Thresholds>) => void
  liveError: string | null
  now: number
  states: Record<ComponentId, CompState>
  selected: ComponentId
  select: (id: ComponentId) => void
}

const TelemetryCtx = createContext<Ctx | null>(null)

export function useTelemetry(): Ctx {
  const c = useContext(TelemetryCtx)
  if (!c) throw new Error('useTelemetry must be used inside <TelemetryProvider>')
  return c
}

const BUFFER_MAX = 20000

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('simulation')
  const [controls, setControls] = useState<SimControls>(defaultControls)
  const [cfg, setCfgState] = useState<Thresholds>(DEFAULT_THRESHOLDS)
  const [recent, setRecent] = useState<Telemetry[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [volumeL, setVolume] = useState(0)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [selected, select] = useState<ComponentId>('pump')

  const buf = useRef<Telemetry[]>([])
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const modeRef = useRef(mode)
  modeRef.current = mode
  const seen = useRef<Record<string, number>>({})
  const prevAlerts = useRef<Alert[]>([])

  const logEvent = useCallback((text: string, kind: EventItem['kind'] = 'info') => {
    setEvents((e) => [{ t: Date.now(), text, kind }, ...e].slice(0, 80))
  }, [])

  const push = useCallback((r: Telemetry) => {
    const b = buf.current
    const lastT = b.length ? tsOf(b[b.length - 1]) : -1
    if (tsOf(r) === lastT) return
    b.push(r)
    if (b.length > BUFFER_MAX) b.shift()
    setRecent(b.slice(-600))
  }, [])

  const setMode = useCallback(
    (m: Mode) => {
      if (modeRef.current === m) return
      buf.current = []
      seen.current = {}
      setRecent([])
      setVolume(0)
      setLiveError(null)
      setModeState(m)
      if (m === 'simulation') {
        setControls((c) => ({ ...c, frozen: false }))
        logEvent('Connected to ESP32-S3 sensor stream.')
      } else {
        logEvent('Switched to Server Bridge mode. Waiting for telemetry packets.', 'info')
      }
    },
    [logEvent],
  )

  // Simulation clock: one generated sample per second.
  useEffect(() => {
    if (mode !== 'simulation') return
    if (!buf.current.length) {
      push(simRow(Date.now(), controlsRef.current))
      logEvent('ESP32-S3 sensor stream initialized. TinyML neural network active.')
    }
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      const c = controlsRef.current
      if (c.frozen) return
      const r = simRow(t, c)
      push(r)
      if (r.flow_lpm != null) setVolume((v) => v + r.flow_lpm! / 60)
    }, 1000)
    return () => window.clearInterval(id)
  }, [mode, push, logEvent])

  // Live clock: poll the backend. No generated values are ever inserted here.
  useEffect(() => {
    if (mode !== 'live') return
    let alive = true
    const ctrl = new AbortController()
    const poll = async () => {
      setNow(Date.now())
      try {
        const r = await api.latest(ctrl.signal)
        if (!alive) return
        setLiveError(null)
        if (r) {
          push({ ...r, mode: 'live' })
        }
      } catch (e) {
        if (!alive) return
        setLiveError(e instanceof Error ? e.message : 'unreachable')
      }
    }
    poll()
    const id = window.setInterval(poll, LIVE_POLL_MS)
    return () => {
      alive = false
      ctrl.abort()
      window.clearInterval(id)
    }
  }, [mode, push])

  // Diagnostics run on every clock tick.
  useEffect(() => {
    const raw = evaluate({ recent, mode, liveError, now, cfg })
    const keys = new Set(raw.map((a) => a.key))
    const withSince: Alert[] = raw.map((a) => {
      if (seen.current[a.key] == null) {
        seen.current[a.key] = now
        if (a.key !== 'turbidity-absent') logEvent(`Raised: ${a.title}`, a.severity)
      }
      return { ...a, since: seen.current[a.key] }
    })
    Object.keys(seen.current).forEach((k) => {
      if (!keys.has(k)) {
        const was = prevAlerts.current.find((a) => a.key === k)
        delete seen.current[k]
        if (was) logEvent(`Cleared: ${was.title}`, 'ok')
      }
    })
    prevAlerts.current = withSince
    setAlerts(withSince)
  }, [recent, mode, liveError, now, cfg, logEvent])

  const last = recent.length ? recent[recent.length - 1] : null
  const states = useMemo(() => componentStates(last, mode, alerts, cfg, now), [last, mode, alerts, cfg, now])

  const value: Ctx = {
    mode,
    setMode,
    controls,
    patchControls: (p) => {
      setControls((c) => {
        const next = { ...c, ...p }
        if (p.pump === true && !c.pump) next.pumpSince = Date.now()
        return next
      })
    },
    resetControls: () => {
      setControls(defaultControls())
      logEvent('ESP32 sensor parameters restored to baseline.')
    },
    last,
    recent,
    alerts,
    events,
    volumeL,
    cfg,
    setCfg: (p) => setCfgState((c) => ({ ...c, ...p })),
    liveError,
    now,
    states,
    selected,
    select,
  }
  return <TelemetryCtx.Provider value={value}>{children}</TelemetryCtx.Provider>
}
