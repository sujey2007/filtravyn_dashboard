import { useTelemetry } from '../app/TelemetryContext'
import type { Dis } from '../services/simulator'

function DisSelect({ id, label, value, disabled, onChange }: { id: string; label: string; value: Dis; disabled: boolean; onChange: (v: Dis) => void }) {
  return (
    <label className="fld" htmlFor={id}>
      {label}
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Dis)}>
        <option value="ok">Normal</option>
        <option value="off">Disconnected</option>
        <option value="bad">Out of range</option>
      </select>
    </label>
  )
}

/** Parameter controls for ESP32 sensors and bench testing. */
export function ScenarioBench() {
  const { mode, controls: s, patchControls, resetControls } = useTelemetry()
  const d = mode !== 'simulation'
  return (
    <div>
      <div className="bench">
        <div className="fld">
          Diaphragm pump
          <button className="btn ghost" disabled={d} onClick={() => patchControls({ pump: !s.pump })}>
            Pump commanded {s.pump ? 'on (Click to turn off)' : 'off (Click to turn on)'}
          </button>
        </div>
        <label className="fld" htmlFor="b-flow">
          Flow rate setpoint: <span className="num">{s.flow.toFixed(2)}</span> L/min
          <input id="b-flow" type="range" min={0.5} max={3.0} step={0.1} value={s.flow} disabled={d} onChange={(e) => patchControls({ flow: +e.target.value })} />
        </label>
        <label className="fld" htmlFor="b-tds">
          TDS offset: <span className="num">+{s.tdsOffset}</span> ppm
          <input id="b-tds" type="range" min={0} max={600} step={10} value={s.tdsOffset} disabled={d} onChange={(e) => patchControls({ tdsOffset: +e.target.value })} />
        </label>
        <label className="fld" htmlFor="b-turb">
          Turbidity offset: <span className="num">+{s.turbidityOffset.toFixed(1)}</span> NTU
          <input id="b-turb" type="range" min={0} max={12} step={0.5} value={s.turbidityOffset} disabled={d} onChange={(e) => patchControls({ turbidityOffset: +e.target.value })} />
        </label>
        <label className="fld" htmlFor="b-temp">
          Temperature offset: <span className="num">+{s.tempOffset}</span> °C
          <input id="b-temp" type="range" min={0} max={15} step={1} value={s.tempOffset} disabled={d} onChange={(e) => patchControls({ tempOffset: +e.target.value })} />
        </label>
        <DisSelect id="b-dtds" label="TDS probe" value={s.dis.tds} disabled={d} onChange={(v) => patchControls({ dis: { ...s.dis, tds: v } })} />
        <DisSelect id="b-dturb" label="Turbidity sensor (Pin 6)" value={s.dis.turbidity} disabled={d} onChange={(v) => patchControls({ dis: { ...s.dis, turbidity: v } })} />
        <DisSelect id="b-dtemp" label="Temperature sensor" value={s.dis.temperature} disabled={d} onChange={(v) => patchControls({ dis: { ...s.dis, temperature: v } })} />
        <DisSelect id="b-dflow" label="Flow turbine" value={s.dis.flow} disabled={d} onChange={(v) => patchControls({ dis: { ...s.dis, flow: v } })} />
        <div className="fld">
          <label className="chk"><input type="checkbox" checked={s.blocked} disabled={d} onChange={(e) => patchControls({ blocked: e.target.checked })} />Pump on, no flow (blockage)</label>
          <label className="chk"><input type="checkbox" checked={s.ghost} disabled={d} onChange={(e) => patchControls({ ghost: e.target.checked })} />Flow while pump is off (leak/gravity)</label>
          <label className="chk"><input type="checkbox" checked={s.pumpFault} disabled={d} onChange={(e) => patchControls({ pumpFault: e.target.checked })} />Pump report hardware fault</label>
          <label className="chk"><input type="checkbox" checked={s.frozen} disabled={d} onChange={(e) => patchControls({ frozen: e.target.checked })} />Simulate network delay / timeout</label>
        </div>
        <div className="fld">
          Default baseline
          <button className="btn ghost" disabled={d} onClick={resetControls}>Reset parameters to normal</button>
        </div>
      </div>
    </div>
  )
}
