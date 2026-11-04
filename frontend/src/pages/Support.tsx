import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTelemetry } from '../app/TelemetryContext'
import { PageHead, Pill } from '../components/ui'
import { CARE, EXAMPLE_LOG, FAQ, FILTER_STEPS, TREES, type LogEntry } from '../data/support'
import { api, type ChatMessage, type ChatTelemetry } from '../services/api'

type Tab = 'faq' | 'trouble' | 'filter' | 'care' | 'log'
const LOG_KEY = 'fv-service-log'

type Msg = ChatMessage

export function Support() {
  const { last, mode } = useTelemetry()
  const [tab, setTab] = useState<Tab>('faq')
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'model', text: 'I can help with the FiltraVyn purifier, dashboard readings, maintenance, and troubleshooting.' },
  ])
  const [q, setQ] = useState('')
  const [chatError, setChatError] = useState('')
  const [chatPending, setChatPending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const [tree, setTree] = useState<{ k: string; node: string } | null>(null)
  const [log, setLog] = useState<LogEntry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as LogEntry[]
      return [...saved, ...EXAMPLE_LOG]
    } catch {
      return EXAMPLE_LOG
    }
  })
  const [entry, setEntry] = useState({ d: '', type: 'Filter replaced', note: '' })

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [msgs, chatPending, chatError])

  const ask = async (text: string) => {
    const question = text.trim()
    if (!question || chatPending) return
    const previous = msgs
    const userMessage: Msg = { role: 'user', text: question }
    const messages = [...previous.slice(1).slice(-10), userMessage]
    const telemetry: ChatTelemetry = {
      mode,
      tds_ppm: last?.tds_ppm ?? null,
      temperature_c: last?.temperature_c ?? null,
      flow_lpm: last?.flow_lpm ?? null,
      turbidity_ntu: last?.turbidity_ntu ?? null,
      pump_state: last?.pump_state ?? 'unknown',
      sensor_status: last?.sensor_status ?? {
        tds: 'unknown',
        temperature: 'unknown',
        flow: 'unknown',
        turbidity: 'unknown',
      },
    }
    setQ('')
    setChatError('')
    setChatPending(true)
    setMsgs([...previous, userMessage])
    try {
      const reply = await api.chat(messages, telemetry)
      setMsgs((current) => [...current, { role: 'model', text: reply }])
    } catch (error) {
      setMsgs(previous)
      setQ(question)
      setChatError(error instanceof Error ? error.message : 'Unable to reach the AI assistant.')
    } finally {
      setChatPending(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(q)
  }
  const addLog = (e: FormEvent) => {
    e.preventDefault()
    const d = entry.d || new Date().toISOString().slice(0, 10)
    const next = [{ d, type: entry.type, note: entry.note.trim() || 'No note' }, ...log]
    setLog(next)
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(next.filter((x) => !x.example)))
    } catch {
      /* storage can be unavailable */
    }
    setEntry({ ...entry, note: '' })
  }

  const T = tree ? TREES[tree.k] : null
  const node = T && tree ? T.n[tree.node] : null

  return (
    <>
      <PageHead title="Support and DIY">Guides for the current prototype, a service log, and an AI assistant for purifier-related questions.</PageHead>
      <div className="sup">
        <div className="panel">
          <div className="ph"><h2>Assistant</h2><Pill kind="info">Gemini AI</Pill></div>
          <div className="chatlog" ref={logRef} aria-live="polite">
            {msgs.map((m, i) => <div key={i} className={'msg ' + (m.role === 'model' ? 'a' : 'u')}>{m.text}</div>)}
            {chatPending && <div className="msg a" role="status">Thinking…</div>}
          </div>
          {chatError && <div className="chat-error" role="alert">{chatError}</div>}
          <div className="sug" style={{ paddingTop: 10 }}>
            {['Current readings', 'Replace filter', 'No flow', 'Is TDS enough?'].map((s) => (
              <button key={s} disabled={chatPending} onClick={() => void ask(s)}>{s}</button>
            ))}
          </div>
          <form className="chatin" onSubmit={submit}>
            <input type="text" id="chatq" placeholder="Ask about your purifier" autoComplete="off" aria-label="Question" maxLength={2000} value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" type="submit" disabled={chatPending || !q.trim()}>{chatPending ? 'Sending…' : 'Send'}</button>
          </form>
          <div className="chat-note">AI responses can be inaccurate. TDS alone cannot determine whether water is safe to drink.</div>
        </div>

        <div className="panel">
          <div className="tabs" role="tablist">
            {([['faq', 'FAQ'], ['trouble', 'Troubleshooting'], ['filter', 'Filter change'], ['care', 'Sensor care'], ['log', 'Service log']] as [Tab, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {tab === 'faq' && (
            <div>
              {FAQ.map(([qq, aa]) => (
                <details className="faq" key={qq}><summary>{qq}</summary><p>{aa}</p></details>
              ))}
            </div>
          )}

          {tab === 'trouble' && (
            <div className="qa">
              {!T || !node || !tree ? (
                <>
                  <div className="q">Pick a problem</div>
                  <div className="opts">
                    {Object.entries(TREES).map(([k, t]) => (
                      <button key={k} className="btn ghost" onClick={() => setTree({ k, node: t.start })}>{t.title}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="tagline">{T.title}</div>
                  {node.q ? (
                    <>
                      <div className="q">{node.q}</div>
                      <div className="opts">
                        {node.o?.map(([label, to]) => (
                          <button key={label} className="btn ghost" onClick={() => setTree({ k: tree.k, node: to })}>{label}</button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="res">{node.r}</div>
                  )}
                  <div><button className="btn ghost" onClick={() => setTree(null)}>Start over</button></div>
                </>
              )}
            </div>
          )}

          {tab === 'filter' && (
            <>
              <div className="safety">
                <b>Before you start.</b> Keep mains and 24 V supplies away from water. Isolate power first. Flush a new cartridge as its maker
                directs before drinking the output. This console cannot confirm the water is safe.
              </div>
              <ol className="steps">{FILTER_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
            </>
          )}

          {tab === 'care' && (
            <div className="list">
              {CARE.map(([n, t]) => (
                <div className="li" key={n}><b style={{ minWidth: 130 }}>{n}</b><span className="muted" style={{ flex: 1, minWidth: 200 }}>{t}</span></div>
              ))}
            </div>
          )}

          {tab === 'log' && (
            <>
              <form className="bench" onSubmit={addLog} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                <label className="fld" htmlFor="l-d">Date<input type="date" id="l-d" value={entry.d} onChange={(e) => setEntry({ ...entry, d: e.target.value })} /></label>
                <label className="fld" htmlFor="l-t">
                  Type
                  <select id="l-t" value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value })}>
                    <option>Filter replaced</option><option>Sensor cleaned</option><option>Pump serviced</option><option>Other</option>
                  </select>
                </label>
                <label className="fld" htmlFor="l-n" style={{ gridColumn: 'span 2' }}>Note<input type="text" id="l-n" placeholder="What was done" value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} /></label>
                <div className="fld">&nbsp;<button className="btn" type="submit">Add entry</button></div>
              </form>
              <div className="list">
                {log.map((l, i) => (
                  <div className="li" key={l.d + l.type + i}>
                    <span className="t">{l.d}</span><b style={{ minWidth: 120 }}>{l.type}</b>
                    <span className="muted" style={{ flex: 1, minWidth: 180 }}>{l.note}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
