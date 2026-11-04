import { useState } from 'react'
import { useModel } from '../../app/ModelContext'
import { useTelemetry } from '../../app/TelemetryContext'
import { Legend } from '../../components/ui'
import { Twin } from './Twin'
import { tsOf } from '../../types/telemetry'

/** The 3D stage shared by Overview and Digital twin. Water animation follows real or simulated flow only. */
export function TwinStage({ big = false, showRotate = false }: { big?: boolean; showRotate?: boolean }) {
  const { states, last, mode, selected, select, cfg, now } = useTelemetry()
  const model = useModel()
  const [resetSignal, setResetSignal] = useState(0)
  const [rotate, setRotate] = useState(false)

  const fresh = last != null && (now - tsOf(last)) / 1000 <= cfg.staleTimeoutS
  const flow = fresh && last!.sensor_status.flow === 'valid' ? last!.flow_lpm : null
  // On a user model, water only animates along a mapped route. None is implemented until pipeRoute is set.
  const animate = !model.modelUrl

  return (
    <div className={'stage' + (big ? ' big' : '')}>
      <Twin
        states={states}
        flowLpm={animate ? flow : null}
        selected={selected}
        onSelect={select}
        resetSignal={resetSignal}
        autoRotate={rotate}
        modelUrl={model.modelUrl}
        mapping={model.mapping}
        pipeRoute={model.pipeRoute}
        onMeshNames={model.setMeshNames}
        onModelError={(m) => model.setError(m)}
      />
      {!model.modelUrl && <div className="stage-note">Placeholder schematic. Awaiting SolidWorks design.</div>}
      <div className="stage-tools">
        <button className="btn ghost sm" onClick={() => setResetSignal((n) => n + 1)}>
          Reset view
        </button>
        {showRotate && (
          <button className="btn ghost sm" aria-pressed={rotate} onClick={() => setRotate((r) => !r)}>
            {rotate ? 'Stop rotating' : 'Auto-rotate'}
          </button>
        )}
      </div>
      <div className="tagline" style={{ position: 'absolute', right: 12, bottom: 10, background: 'rgba(255,255,255,.85)', padding: '3px 8px', border: '1px solid var(--line2)', borderRadius: 2 }}>
        {mode === 'simulation' ? 'Simulated state' : 'Device state'}
      </div>
      <Legend />
    </div>
  )
}
