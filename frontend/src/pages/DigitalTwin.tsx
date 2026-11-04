import { useState } from 'react'
import { useModel } from '../app/ModelContext'
import { useTelemetry } from '../app/TelemetryContext'
import { ComponentChips, ComponentInfo, PageHead } from '../components/ui'
import { TwinStage } from '../features/digital-twin/TwinStage'
import type { Mapping } from '../features/digital-twin/Twin'

const MAP_TEMPLATE = `{
  "tank": [],
  "pump": [],
  "filter": [],
  "flowSensor": [],
  "cell": [],
  "outlet": []
}`

export function DigitalTwin() {
  const { states, selected, select } = useTelemetry()
  const m = useModel()
  const [text, setText] = useState(() => (Object.keys(m.mapping).length ? JSON.stringify(m.mapping, null, 2) : MAP_TEMPLATE))
  const [msg, setMsg] = useState('')

  const apply = () => {
    try {
      const parsed = JSON.parse(text) as Mapping
      m.setMapping(parsed)
      const counts = Object.entries(parsed).map(([k, v]) => `${k} ${(v ?? []).filter((n) => m.meshNames.includes(n)).length}`)
      setMsg(m.modelUrl ? `Mapping applied. Matched meshes: ${counts.join(', ')}.` : 'Mapping saved. Load a model to see it take effect.')
    } catch (e) {
      setMsg('Mapping is not valid JSON: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <>
      <PageHead title="Digital twin">
        Component state drawn on the water path. Load your own GLB to replace the placeholder.
      </PageHead>
      <div className="ov">
        <div className="panel">
          <TwinStage big showRotate />
          <ComponentChips states={states} selected={selected} onSelect={select} />
          <ComponentInfo id={selected} state={states[selected]} />
        </div>
        <div className="col">
          <div className="panel">
            <div className="ph"><h2>Use your SolidWorks model</h2></div>
            <div className="pb" style={{ display: 'grid', gap: 10 }}>
              <p className="small muted">
                Browsers cannot open SolidWorks files directly. Export or convert your assembly to GLB, keeping part names. STEP files need a
                separate conversion first. To keep a model across reloads, copy it to <code className="num">public/models</code> and set it in{' '}
                <code className="num">model.config.json</code>.
              </p>
              <label className="fld" htmlFor="glbfile">
                GLB file
                <input
                  id="glbfile"
                  type="file"
                  accept=".glb"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) m.useUpload(f)
                  }}
                />
              </label>
              <div className="small muted">
                {m.error
                  ? `Could not load this model: ${m.error}`
                  : m.modelUrl
                    ? `Loaded ${m.fileName ?? 'model'}. Water animation is off because no pipe route is mapped.`
                    : 'No model loaded. The schematic shows only the order of the water path. Positions and shapes are not your product.'}
              </div>
              <button className="btn ghost" onClick={m.clear}>Back to placeholder</button>
            </div>
          </div>
          <div className="panel">
            <div className="ph"><h2>Part mapping</h2></div>
            <div className="pb" style={{ display: 'grid', gap: 10 }}>
              <p className="small muted">
                Map mesh names from your model to component ids. Nothing is guessed. Unmapped parts keep their own colours.
              </p>
              <div className="small muted">
                {m.meshNames.length
                  ? <>Mesh names: {m.meshNames.slice(0, 60).map((n) => <code className="num" key={n}>{n} </code>)}{m.meshNames.length > 60 ? `and ${m.meshNames.length - 60} more` : ''}</>
                  : 'Mesh names appear after a model loads. If a model has none, name the parts in your CAD or export settings.'}
              </div>
              <label className="fld" htmlFor="mapjson">
                Mapping (JSON)
                <textarea id="mapjson" rows={8} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} style={{ fontFamily: 'var(--f-num)', fontSize: 12 }} />
              </label>
              <button className="btn" onClick={apply}>Apply mapping</button>
              <div className="small muted">{msg}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
