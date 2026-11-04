import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTelemetry } from '../app/TelemetryContext'
import { api, type ChatMessage, type ChatTelemetry } from '../services/api'

const START_MESSAGE: ChatMessage = {
  role: 'model',
  text: 'Hi! Ask me about your FiltraVyn purifier, readings, maintenance, or troubleshooting.',
}

export function ChatWidget() {
  const { last, mode } = useTelemetry()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([START_MESSAGE])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
    }
  }, [open, messages, pending, error])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const text = question.trim()
    if (!text || pending) return

    const userMessage: ChatMessage = { role: 'user', text }
    const conversation = [...messages.slice(1).slice(-10), userMessage]
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

    setQuestion('')
    setError('')
    setPending(true)
    setMessages((current) => [...current, userMessage])
    try {
      const reply = await api.chat(conversation, telemetry)
      setMessages((current) => [...current, { role: 'model', text: reply }])
    } catch (reason) {
      setMessages((current) => current.filter((message) => message !== userMessage))
      setQuestion(text)
      setError(reason instanceof Error ? reason.message : 'Unable to reach the AI assistant.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-window" role="dialog" aria-modal="false" aria-labelledby="chat-widget-title">
          <header className="chat-widget-head">
            <div>
              <h2 id="chat-widget-title">FiltraVyn assistant</h2>
              <span>Gemini AI · purifier support</span>
            </div>
            <button className="chat-close" type="button" aria-label="Close chat" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </header>
          <div className="chat-widget-log" ref={logRef} aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={`msg ${message.role === 'model' ? 'a' : 'u'}`}>
                {message.text}
              </div>
            ))}
            {pending && <div className="msg a" role="status">Thinking…</div>}
          </div>
          {error && <div className="chat-error" role="alert">{error}</div>}
          <form className="chat-widget-form" onSubmit={send}>
            <input
              ref={inputRef}
              type="text"
              aria-label="Ask the FiltraVyn assistant"
              placeholder="Ask a purifier question"
              maxLength={2000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button className="btn" type="submit" disabled={pending || !question.trim()}>
              Send
            </button>
          </form>
          <p className="chat-widget-note">AI may be inaccurate. TDS alone cannot establish drinking-water safety.</p>
        </section>
      )}
      <button
        className="chat-launcher"
        type="button"
        aria-label={open ? 'Close assistant chat' : 'Open assistant chat'}
        aria-expanded={open}
        onClick={() => setOpen((visible) => !visible)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.4-.8L4 20l1.5-4A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 11.5 4H12a7.5 7.5 0 0 1 8 7.5Z" />
            <path d="M8 11h.01M12 11h.01M16 11h.01" />
          </svg>
        )}
      </button>
    </div>
  )
}
