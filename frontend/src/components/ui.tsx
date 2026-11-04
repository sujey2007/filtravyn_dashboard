import type { ReactNode } from 'react'
import { COMPONENTS, COMP_BY_ID, type ComponentId } from '../data/components'
import { STATE_LABEL, type CompState } from '../services/componentState'
import type { PillKind } from '../services/status'

export function Pill({ kind, children }: { kind: PillKind; children: ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>
}

export function PageHead({ title, children, right }: { title: string; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {children ? <p className="muted">{children}</p> : null}
      </div>
      {right}
    </div>
  )
}

export function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: 'var(--ok)' }} />Normal or active</span>
      <span><i style={{ background: '#D79A1B' }} />Warning</span>
      <span><i style={{ background: 'var(--crit)' }} />Fault</span>
      <span><i style={{ background: 'transparent', border: '2px solid var(--na)' }} />Unavailable</span>
      <span><i className="ring" />Selected</span>
    </div>
  )
}

export function ComponentChips({
  states,
  selected,
  onSelect,
}: {
  states: Record<ComponentId, CompState>
  selected: ComponentId
  onSelect: (id: ComponentId) => void
}) {
  return (
    <div className="chips" role="group" aria-label="Components">
      {COMPONENTS.map((c) => (
        <button key={c.id} className="chip" aria-pressed={selected === c.id} onClick={() => onSelect(c.id)}>
          <span className={`dot ${states[c.id].st}`} />
          {c.short}
        </button>
      ))}
    </div>
  )
}

export function ComponentInfo({ id, state }: { id: ComponentId; state: CompState }) {
  const c = COMP_BY_ID[id]
  return (
    <div className="info">
      <h3>
        {c.name}{' '}
        <span className={`pill ${state.st}`}>
          {STATE_LABEL[state.st]}
          {state.label && state.st !== 'na' ? ` · ${state.label}` : ''}
        </span>
      </h3>
      <ul>
        {c.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  )
}

export function ReadingCard({
  label,
  value,
  unit,
  pill,
  note,
}: {
  label: string
  value: string
  unit?: string
  pill: [PillKind, string]
  note?: string
}) {
  return (
    <div className="rd">
      <div className="lb">{label}</div>
      <div className={'v' + (unit === undefined ? ' words' : '')}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      <div className="row">
        <Pill kind={pill[0]}>{pill[1]}</Pill>
        <span className="tagline">{note}</span>
      </div>
    </div>
  )
}
