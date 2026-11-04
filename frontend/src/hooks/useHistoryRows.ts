import { useEffect, useMemo, useRef, useState } from 'react'
import { useTelemetry } from '../app/TelemetryContext'
import { api } from '../services/api'
import { histRow } from '../services/simulator'
import type { RangeKey, Telemetry } from '../types/telemetry'
import { tsOf } from '../types/telemetry'

export const RANGES: Record<RangeKey, { window: number; step: number }> = {
  '1h': { window: 3600e3, step: 60e3 },
  '24h': { window: 86400e3, step: 600e3 },
  '7d': { window: 7 * 86400e3, step: 3600e3 },
  '30d': { window: 30 * 86400e3, step: 4 * 3600e3 },
}

const START = Date.now()

/**
 * Rows for the selected range.
 * Simulation: generated sample history from before the page opened, then the running simulator.
 * Live: fetched from the backend only. An empty array means no data, never filled with samples.
 */
export function useHistoryRows(range: RangeKey): { rows: Telemetry[]; error: string | null } {
  const { mode, recent, now } = useTelemetry()
  const [liveRows, setLiveRows] = useState<Telemetry[]>([])
  const [error, setError] = useState<string | null>(null)
  const tick = Math.floor(now / 5000)
  const nowRef = useRef(now)
  nowRef.current = now

  useEffect(() => {
    if (mode !== 'live') return
    const ctrl = new AbortController()
    const to = new Date(nowRef.current)
    const from = new Date(nowRef.current - RANGES[range].window)
    api
      .readings(from.toISOString(), to.toISOString(), 5000, ctrl.signal)
      .then((r) => {
        setLiveRows(r)
        setError(null)
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return
        setLiveRows([])
        setError(e instanceof Error ? e.message : 'unreachable')
      })
    return () => ctrl.abort()
  }, [mode, range, Math.floor(now / 10000)])

  const simRows = useMemo(() => {
    if (mode !== 'simulation') return []
    const { window, step } = RANGES[range]
    const start = Date.now() - window
    const rows: Telemetry[] = []
    for (let t = Math.ceil(start / step) * step; t < START; t += step) rows.push(histRow(t))
    let lastT = -1
    recent.forEach((r) => {
      const t = tsOf(r)
      if (t < start) return
      if (lastT < 0 || t - lastT >= step) {
        rows.push(r)
        lastT = t
      }
    })
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, range, tick, recent.length])

  return mode === 'live' ? { rows: liveRows, error } : { rows: simRows, error: null }
}
