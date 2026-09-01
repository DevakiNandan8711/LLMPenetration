import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import agentNode from './assets/agent-node.svg'
import { apiUrl, createChallenge, executeCommand, fetchChallenges, fetchHealth } from './api'

const STORAGE_KEY = 'hacksynth-dashboard-state-v2'

const FALLBACK_CHALLENGES = [
  { id: 'ctf-web-01', name: 'Web Exploit Lab', environment: '10.0.0.5', difficulty: 'Easy' },
  { id: 'ctf-network-02', name: 'Network Pivot Lab', environment: '10.0.0.12', difficulty: 'Medium' },
  { id: 'ctf-privesc-03', name: 'Privilege Escalation Lab', environment: '10.0.0.25', difficulty: 'Hard' },
]

const DEFAULT_STATS = { steps: 0, tokens: 0, errors: 0 }
const DEFAULT_MAX_STEPS = 8

const API_ENDPOINTS = [
  { id: 'planner', route: 'POST /planner', note: 'Generates next command from context' },
  { id: 'executor', route: 'POST /executor', note: 'Runs command in Docker sandbox' },
  { id: 'summarizer', route: 'POST /summarizer', note: 'Converts raw output into compact signal' },
  { id: 'runloop', route: 'POST /run-loop', note: 'Orchestrates full autonomous cycle' },
]

const SAFETY_CONTROLS = [
  'Docker process isolation boundary',
  'Execution timeout per command',
  'Max-step guard for each run',
  'Restricted network and command policy',
  'Manual user interrupt and reset control',
]

const STACK = [
  'React + Vite frontend',
  'FastAPI backend orchestration',
  'LLM planner and summarizer modules',
  'Docker command execution sandbox',
  'Optional PostgreSQL or MongoDB persistence',
]

const EVALUATION = [
  'Flag success rate per challenge',
  'Average steps to completion',
  'Token usage per run',
  'Planner hallucination rate',
  'Execution error ratio',
]

const SIDEBAR_SECTIONS = [
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'overview' },
  { id: 'live-metrics', path: '/live-metrics', label: 'Live Metrics', icon: 'metrics' },
  { id: 'simulation-control', path: '/simulation-control', label: 'Simulation Control', icon: 'control' },
  { id: 'terminal-output', path: '/terminal-output', label: 'Terminal Output', icon: 'terminal' },
  { id: 'command-timeline', path: '/command-timeline', label: 'Command Timeline', icon: 'timeline' },
  { id: 'result-snapshot', path: '/result-snapshot', label: 'Result Snapshot', icon: 'result' },
  { id: 'technical-dossier', path: '/technical-dossier', label: 'Technical Dossier', icon: 'dossier' },
]

function Icon({ type }) {
  if (type === 'status') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Z" />
        <path d="M13 3h8v8h-2V6.4L12.4 13 11 11.6 17.6 5H13V3Z" />
      </svg>
    )
  }
  if (type === 'progress') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h4v2H4v-2Zm6-7h4v9h-4v-9Zm6-5h4v14h-4V6Z" />
      </svg>
    )
  }
  if (type === 'token') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L17.7 7 12 9.7 6.3 7 12 4.3Zm-7 4.4 6 3.2v7.4l-6-3.3V8.7Zm14 7.3-6 3.3v-7.4l6-3.2v7.3Z" />
      </svg>
    )
  }
  if (type === 'runs') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v4H4V4Zm0 6h16v4H4v-4Zm0 6h10v4H4v-4Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a8 8 0 1 1-8 8h2a6 6 0 1 0 6-6V4Zm-1 4h2v5h-2V8Zm0 6h2v2h-2v-2Z" />
    </svg>
  )
}

function SidebarIcon({ type }) {
  const cleanIcons = {
    overview: 'O',
    metrics: 'M',
    control: 'C',
    terminal: '$',
    timeline: '>',
    result: 'F',
    dossier: 'D',
  }
  if (type) return <span className="sidebar-icon">{cleanIcons[type] || '-'}</span>

  const icons = {
    overview: '⌁',
    target: '◎',
    metrics: '◔',
    control: '⚙',
    terminal: '⌨',
    timeline: '⟶',
    result: '⚑',
    dossier: '▣',
    runs: '▤',
    storage: '⬢',
    checklist: '✓',
    test: '🧪',
  }
  return <span className="sidebar-icon">{icons[type] || '•'}</span>
}

const readStoredState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    return {
      selectedChallenge: state.selectedChallenge || FALLBACK_CHALLENGES[0].id,
      logs: Array.isArray(state.logs) ? state.logs : [],
      history: Array.isArray(state.history) ? state.history : [],
      runRecords: Array.isArray(state.runRecords) ? state.runRecords : [],
      stats:
        state.stats &&
        typeof state.stats.steps === 'number' &&
        typeof state.stats.tokens === 'number' &&
        typeof state.stats.errors === 'number'
          ? state.stats
          : DEFAULT_STATS,
      flag: typeof state.flag === 'string' ? state.flag : '',
      technicalTab: state.technicalTab || 'architecture',
    }
  } catch {
    return null
  }
}

function App() {
  const stored = readStoredState()
  const [challenges, setChallenges] = useState(FALLBACK_CHALLENGES)
  const [selectedChallenge, setSelectedChallenge] = useState(stored?.selectedChallenge || FALLBACK_CHALLENGES[0].id)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState(stored?.logs || [])
  const [history, setHistory] = useState(stored?.history || [])
  const [runRecords, setRunRecords] = useState(stored?.runRecords || [])
  const [stats, setStats] = useState(stored?.stats || DEFAULT_STATS)
  const [flag, setFlag] = useState(stored?.flag || '')
  const [technicalTab, setTechnicalTab] = useState(stored?.technicalTab || 'architecture')
  const [sectionQuery, setSectionQuery] = useState('')
  const [autoScrollLogs, setAutoScrollLogs] = useState(true)
  const [backendHealth, setBackendHealth] = useState({ ok: false, detail: null })
  const [forceDemoSequence, setForceDemoSequence] = useState(false)
  const [stepTarget, setStepTarget] = useState(DEFAULT_MAX_STEPS)
  const [maxSteps, setMaxSteps] = useState(DEFAULT_MAX_STEPS)
  const [newChallenge, setNewChallenge] = useState({
    name: '',
    environment: '',
    difficulty: 'Custom',
    description: '',
  })
  const [challengeError, setChallengeError] = useState('')

  const [customCommand, setCustomCommand] = useState('curl -s -i http://10.0.0.5/')
  const [isRunningCustom, setIsRunningCustom] = useState(false)
  const [customResult, setCustomResult] = useState(null)
  const [customError, setCustomError] = useState('')

  const timerRef = useRef(null)
  const terminalBodyRef = useRef(null)
  const runAbortRef = useRef(null)
  const lastPlannerCmdRef = useRef('')

  const currentChallenge = useMemo(
    () => challenges.find((challenge) => challenge.id === selectedChallenge) || challenges[0] || FALLBACK_CHALLENGES[0],
    [challenges, selectedChallenge],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedChallenge,
        logs,
        history,
        runRecords,
        stats,
        flag,
        technicalTab,
      }),
    )
  }, [selectedChallenge, logs, history, runRecords, stats, flag, technicalTab])

  useEffect(() => {
    let cancelled = false
    fetchHealth()
      .then((detail) => {
        if (!cancelled) setBackendHealth({ ok: true, detail })
      })
      .catch(() => {
        if (!cancelled) setBackendHealth({ ok: false, detail: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchChallenges()
      .then((payload) => {
        if (cancelled || !Array.isArray(payload.challenges) || payload.challenges.length === 0) return
        setChallenges(payload.challenges)
        setSelectedChallenge((current) =>
          payload.challenges.some((challenge) => challenge.id === current) ? current : payload.challenges[0].id,
        )
      })
      .catch(() => {
        if (!cancelled) setChallengeError('Using local demo challenges because the API challenge list is offline.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!autoScrollLogs || !terminalBodyRef.current) return
    terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight
  }, [logs, autoScrollLogs])

  const resetRun = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    runAbortRef.current?.abort()
    runAbortRef.current = null
    setIsRunning(false)
    setLogs([])
    setHistory([])
    setFlag('')
    setStats(DEFAULT_STATS)
    setStepTarget(maxSteps)
    lastPlannerCmdRef.current = ''
  }

  const stopRun = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    runAbortRef.current?.abort()
    setLogs((existing) => [...existing, '[System] Run interrupt requested.'])
  }

  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRunRecords([])
    resetRun()
    setLogs(['[System] Local storage cleared.'])
  }

  const runCustom = async () => {
    const cmd = (customCommand || '').trim()
    if (!cmd || isRunningCustom || isRunning) return

    setIsRunningCustom(true)
    setCustomError('')
    setCustomResult(null)
    setLogs((existing) => [...existing, `[System] Running custom command in Docker: ${cmd}`])

    try {
      const result = await executeCommand(cmd, selectedChallenge)
      setCustomResult(result)
      setLogs((existing) => [
        ...existing,
        `[Executor] custom exit_code=${result.exit_code} timed_out=${result.timed_out} mock=${result.mock}`,
      ])
    } catch (err) {
      setCustomError(err?.message || String(err))
      setLogs((existing) => [...existing, `[Error] Custom command failed: ${err?.message || String(err)}`])
    } finally {
      setIsRunningCustom(false)
    }
  }

  const addCustomChallenge = async () => {
    const payload = {
      name: newChallenge.name.trim(),
      environment: newChallenge.environment.trim(),
      difficulty: newChallenge.difficulty.trim() || 'Custom',
      description: newChallenge.description.trim(),
    }
    if (!payload.name || !payload.environment) {
      setChallengeError('Challenge name and target environment are required.')
      return
    }

    setChallengeError('')
    try {
      const created = await createChallenge(payload)
      setChallenges((items) => [created, ...items])
      setSelectedChallenge(created.id)
      setNewChallenge({ name: '', environment: '', difficulty: 'Custom', description: '' })
      setLogs((existing) => [...existing, `[System] Custom CTF challenge added: ${created.name}`])
    } catch (err) {
      const local = {
        id: `local-${Date.now()}`,
        ...payload,
      }
      setChallenges((items) => [local, ...items])
      setSelectedChallenge(local.id)
      setNewChallenge({ name: '', environment: '', difficulty: 'Custom', description: '' })
      setChallengeError(`Backend save failed, so this challenge was added locally for this browser session. ${err?.message || ''}`.trim())
    }
  }

  const exportRunReport = () => {
    const generatedAt = new Date().toISOString()
    const report = [
      'HackSynth Final Penetration Report',
      `Generated: ${generatedAt}`,
      '',
      'Challenge',
      `Name: ${currentChallenge.name}`,
      `Target: ${currentChallenge.environment}`,
      `Difficulty: ${currentChallenge.difficulty}`,
      currentChallenge.description ? `Description: ${currentChallenge.description}` : '',
      '',
      'Summary',
      `Status: ${flag ? 'Flag acquired' : isRunning ? 'Run in progress' : 'No final flag yet'}`,
      `Steps: ${stats.steps}/${stepTarget}`,
      `Tokens: ${stats.tokens}`,
      `Execution errors: ${stats.errors}`,
      `Final flag: ${flag || 'Not found'}`,
      '',
      'Command Timeline',
      ...(history.length
        ? history.map((item) => `${item.step}. ${item.planner}\n   ${item.summary}`)
        : ['No planner steps recorded.']),
      '',
      'Terminal Evidence',
      ...(logs.length ? logs : ['No terminal output recorded.']),
    ]
      .filter((line) => line !== '')
      .join('\n')
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `hacksynth-final-report-${Date.now()}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyFlag = async () => {
    if (!flag) return
    try {
      await navigator.clipboard.writeText(flag)
      setLogs((existing) => [...existing, '[System] Final flag copied to clipboard.'])
    } catch {
      setLogs((existing) => [...existing, '[System] Clipboard unavailable in this browser context.'])
    }
  }

  const startRun = async () => {
    if (isRunning) return
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    runAbortRef.current = new AbortController()
    const { signal } = runAbortRef.current
    setIsRunning(true)
    setLogs([
      `[System] Challenge loaded: ${currentChallenge.name} (${currentChallenge.environment})`,
      '[System] Connecting to FastAPI stream (Planner → Docker executor → Summarizer).',
    ])
    setHistory([])
    setFlag('')
    setStats(DEFAULT_STATS)
    setStepTarget(maxSteps)
    lastPlannerCmdRef.current = ''

    const handleEvent = (ev) => {
      if (ev.type === 'meta') {
        const t = ev.demo_sequence_length ? Math.min(ev.demo_sequence_length, ev.max_steps || maxSteps) : ev.max_steps ?? maxSteps
        setStepTarget(t)
        setLogs((existing) => [
          ...existing,
          `[System] Backend mode: ${ev.demo_mode ? 'demo sequence (no LLM required)' : 'live LLM + Docker'} | cap ${ev.max_steps} steps`,
        ])
      }
      if (ev.type === 'planner') {
        lastPlannerCmdRef.current = ev.command
        setLogs((existing) => {
          const next = [...existing, `[Planner] ${ev.command}`]
          if (ev.reasoning) next.push(`[Planner detail] ${ev.reasoning}`)
          return next
        })
        if (typeof ev.tokens === 'number') {
          setStats((s) => ({ ...s, tokens: s.tokens + ev.tokens }))
        }
      }
      if (ev.type === 'executor') {
        const combined = [ev.stdout, ev.stderr].filter(Boolean).join('\n')
        setLogs((existing) => {
          const next = [...existing, `[Executor] ${combined || '(no output)'}${ev.timed_out ? ' [TIMEOUT]' : ''}`]
          if (ev.mock) next.push('[Executor] Note: mock output (Docker unavailable or USE_MOCK_EXECUTOR).')
          return next
        })
        if (ev.exit_code !== 0 && !ev.mock) {
          setStats((s) => ({ ...s, errors: s.errors + 1 }))
        }
      }
      if (ev.type === 'summarizer') {
        setLogs((existing) => [...existing, `[Summarizer] ${ev.summary}`])
        if (typeof ev.tokens === 'number') {
          setStats((s) => ({ ...s, tokens: s.tokens + ev.tokens }))
        }
        setHistory((h) => [
          ...h,
          { step: h.length + 1, planner: lastPlannerCmdRef.current, summary: ev.summary },
        ])
        setStats((s) => ({ ...s, steps: s.steps + 1 }))
      }
      if (ev.type === 'error') {
        setLogs((existing) => [...existing, `[Error] ${ev.message}`])
      }
      if (ev.type === 'done') {
        if (typeof ev.total_tokens === 'number') {
          setStats((s) => ({ ...s, tokens: ev.total_tokens }))
        }
        if (typeof ev.steps === 'number') {
          setStats((s) => ({ ...s, steps: ev.steps }))
        }
        if (ev.flag) {
          setFlag(ev.flag)
          setLogs((existing) => [...existing, `[System] Final flag acquired: ${ev.flag}`])
          setRunRecords((runs) => [
            {
              id: Date.now(),
              challenge: currentChallenge.name,
              steps: typeof ev.steps === 'number' ? ev.steps : 0,
              tokens: typeof ev.total_tokens === 'number' ? ev.total_tokens : 0,
              flag: ev.flag,
            },
            ...runs,
          ])
        } else {
          setLogs((existing) => [...existing, `[System] Run finished (${ev.reason || 'done'}).`])
        }
      }
    }

    try {
      const res = await fetch(apiUrl('/run-loop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: selectedChallenge,
          max_steps: maxSteps,
          use_demo_sequence: forceDemoSequence ? true : null,
        }),
        signal,
      })
      if (!res.ok) {
        const t = await res.text()
        setLogs((existing) => [...existing, `[System] HTTP ${res.status}: ${t}`])
        return
      }
      const reader = res.body?.getReader()
      if (!reader) {
        setLogs((existing) => [...existing, '[System] Empty response stream from backend.'])
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            handleEvent(JSON.parse(line))
          } catch {
            /* ignore partial JSON */
          }
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setLogs((existing) => [...existing, '[System] Run stopped by user.'])
      } else {
        setLogs((existing) => [...existing, `[System] ${err?.message || err}`])
      }
    } finally {
      setIsRunning(false)
      runAbortRef.current = null
    }
  }

  const completionPercent = stepTarget
    ? Math.round(Math.min(100, (stats.steps / stepTarget) * 100))
    : 0
  const progressStyle = { width: `${Math.min(100, completionPercent)}%` }
  const filteredSections = SIDEBAR_SECTIONS.filter((section) =>
    section.label.toLowerCase().includes(sectionQuery.toLowerCase()),
  )
  const runGraph = [
    { label: 'Progress', value: completionPercent, tone: 'accent' },
    { label: 'Clean steps', value: stats.steps ? Math.round(((stats.steps - stats.errors) / stats.steps) * 100) : 0, tone: 'good' },
    { label: 'Error rate', value: stats.steps ? Math.round((stats.errors / stats.steps) * 100) : 0, tone: 'warn' },
  ]

  const renderRunGraph = () => (
    <div className="run-graph" aria-label="Run performance graph">
      {runGraph.map((item) => (
        <div key={item.label} className="graph-row">
          <span>{item.label}</span>
          <div className="graph-track">
            <div className={`graph-fill ${item.tone}`} style={{ width: `${Math.min(100, item.value)}%` }} />
          </div>
          <strong>{item.value}%</strong>
        </div>
      ))}
    </div>
  )

  const renderSectionView = (sectionId) => {
    if (sectionId === 'dashboard') {
      return (
        <section className="single-view dashboard-view">
          <section className="kpi-grid">
            <article className="card kpi">
              <div className="kpi-icon kpi-status">
                <Icon type="status" />
              </div>
              <p>Run Status</p>
              <h3>{isRunning ? 'RUNNING' : 'IDLE'}</h3>
            </article>
            <article className="card kpi">
              <div className="kpi-icon kpi-progress">
                <Icon type="progress" />
              </div>
              <p>Completion</p>
              <h3>{Math.min(100, completionPercent)}%</h3>
            </article>
            <article className="card kpi">
              <div className="kpi-icon kpi-token">
                <Icon type="token" />
              </div>
              <p>Total Tokens</p>
              <h3>{stats.tokens}</h3>
            </article>
            <article className="card kpi">
              <div className="kpi-icon kpi-runs">
                <Icon type="runs" />
              </div>
              <p>Saved Runs</p>
              <h3>{runRecords.length}</h3>
            </article>
          </section>

          <section className="main-grid">
            <div className="left-column">
              <article className="card">
                <h2>Simulation Control</h2>
                <div className="control-row">
                  <label htmlFor="challenge">Challenge</label>
                  <select
                    id="challenge"
                    value={selectedChallenge}
                    onChange={(event) => {
                      setSelectedChallenge(event.target.value)
                      resetRun()
                    }}
                    disabled={isRunning}
                  >
                    {challenges.map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>
                        {challenge.name} ({challenge.difficulty})
                      </option>
                    ))}
                  </select>
                  <label htmlFor="maxSteps">Max steps</label>
                  <input
                    id="maxSteps"
                    type="number"
                    min="1"
                    max="24"
                    value={maxSteps}
                    onChange={(event) => {
                      const value = Math.max(1, Math.min(24, Number(event.target.value) || DEFAULT_MAX_STEPS))
                      setMaxSteps(value)
                      if (!isRunning) setStepTarget(value)
                    }}
                    disabled={isRunning}
                  />
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={autoScrollLogs}
                      onChange={(event) => setAutoScrollLogs(event.target.checked)}
                    />
                    Auto-scroll logs
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={forceDemoSequence}
                      onChange={(event) => setForceDemoSequence(event.target.checked)}
                      disabled={isRunning}
                    />
                    Force demo sequence
                  </label>
                </div>
                <p className="muted">
                  API: {backendHealth.ok ? 'connected' : 'offline — run backend on :8000'}
                  {backendHealth.detail ? ` | LLM: ${backendHealth.detail.llm_configured ? 'configured' : 'not configured (demo OK)'}` : ''}
                </p>
                <div className="progress-wrap">
                  <div className="progress-bar">
                    <div className="progress-fill" style={progressStyle} />
                  </div>
                  <p>
                    Step {stats.steps}/{stepTarget} | Environment {currentChallenge.environment}
                  </p>
                </div>
                {renderRunGraph()}
              </article>

              <article className="card">
                <h2>Live Terminal Output</h2>
                <div className="terminal">
                  <div className="terminal-head">
                    <span />
                    <span />
                    <span />
                    <strong>hacksynth@simulator</strong>
                  </div>
                  <div className="terminal-body" ref={terminalBodyRef}>
                    {logs.length === 0 ? (
                      <p className="muted">No simulation output yet.</p>
                    ) : (
                      logs.map((line, index) => (
                        <p key={`${line}-${index}`} className="terminal-line">
                          <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                          {line}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </article>
            </div>

            <aside className="right-column">
              <article className="card">
                <h2>Result Snapshot</h2>
                <p>
                  Target IP: <strong>{currentChallenge.environment}</strong>
                </p>
                <p>
                  Difficulty: <strong>{currentChallenge.difficulty}</strong>
                </p>
                <p>
                  Execution Errors: <strong>{stats.errors}</strong>
                </p>
                <p>
                  Final Flag:{' '}
                  {flag ? <code className="flag">{flag}</code> : <span className="muted">Not found yet</span>}
                </p>
                <button onClick={copyFlag} disabled={!flag}>
                  Copy Final Flag
                </button>
                <button onClick={exportRunReport}>Export Report</button>
                {renderRunGraph()}
              </article>

              <article className="card">
                <h2>Planner Command Timeline</h2>
                <div className="timeline">
                  {history.length === 0 ? (
                    <p className="muted">Planner steps will appear here after simulation starts.</p>
                  ) : (
                    history.map((item) => (
                      <div key={item.step} className="timeline-item">
                        <p>
                          <strong>Step {item.step}</strong> - {item.planner}
                        </p>
                        <p className="muted">{item.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </aside>
          </section>
        </section>
      )
    }

    if (sectionId === 'live-metrics') {
      return (
        <section className="single-view metrics-view">
          <div className="kpi-grid">
            <article className="card kpi">
              <div className="kpi-icon kpi-status">
                <Icon type="status" />
              </div>
              <p>Run Status</p>
              <h3>{isRunning ? 'RUNNING' : 'IDLE'}</h3>
            </article>
            <article className="card kpi">
              <div className="kpi-icon kpi-progress">
                <Icon type="progress" />
              </div>
              <p>Completion</p>
              <h3>{Math.min(100, completionPercent)}%</h3>
            </article>
            <article className="card kpi">
              <div className="kpi-icon kpi-token">
                <Icon type="token" />
              </div>
              <p>Total Tokens</p>
              <h3>{stats.tokens}</h3>
            </article>
            <article className="card kpi">
              <div className="kpi-icon kpi-runs">
                <Icon type="runs" />
              </div>
              <p>Saved Runs</p>
              <h3>{runRecords.length}</h3>
            </article>
          </div>
          <article className="card">
            <h2>Run Graph</h2>
            {renderRunGraph()}
          </article>
        </section>
      )
    }

    if (sectionId === 'simulation-control') {
      return (
        <section className="single-view card">
          <h2>Simulation Control</h2>
          <div className="control-row">
            <label htmlFor="challenge">Challenge</label>
            <select
              id="challenge"
              value={selectedChallenge}
              onChange={(event) => {
                setSelectedChallenge(event.target.value)
                resetRun()
              }}
              disabled={isRunning}
            >
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {challenge.name} ({challenge.difficulty})
                </option>
              ))}
            </select>
            <label htmlFor="maxStepsControl">Max steps</label>
            <input
              id="maxStepsControl"
              type="number"
              min="1"
              max="24"
              value={maxSteps}
              onChange={(event) => {
                const value = Math.max(1, Math.min(24, Number(event.target.value) || DEFAULT_MAX_STEPS))
                setMaxSteps(value)
                if (!isRunning) setStepTarget(value)
              }}
              disabled={isRunning}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoScrollLogs}
                onChange={(event) => setAutoScrollLogs(event.target.checked)}
              />
              Auto-scroll logs
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={forceDemoSequence}
                onChange={(event) => setForceDemoSequence(event.target.checked)}
                disabled={isRunning}
              />
              Force demo sequence
            </label>
          </div>
          <div className="control-row actions">
            <button className="btn-primary" onClick={startRun} disabled={isRunning}>
              Start Autonomous Run
            </button>
            <button className="btn-warn" onClick={stopRun} disabled={!isRunning}>
              Stop
            </button>
            <button onClick={resetRun}>Reset</button>
            <button onClick={clearStorage} disabled={isRunning}>
              Clear Storage
            </button>
            <button onClick={exportRunReport}>Export Report</button>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar">
              <div className="progress-fill" style={progressStyle} />
            </div>
            <p>
              Step {stats.steps}/{stepTarget} | Environment {currentChallenge.environment}
            </p>
          </div>
          {renderRunGraph()}

          <div className="custom-challenge">
            <h3>Custom CTF Challenge</h3>
            <div className="challenge-form">
              <input
                value={newChallenge.name}
                onChange={(event) => setNewChallenge((value) => ({ ...value, name: event.target.value }))}
                placeholder="Challenge name"
                disabled={isRunning}
              />
              <input
                value={newChallenge.environment}
                onChange={(event) => setNewChallenge((value) => ({ ...value, environment: event.target.value }))}
                placeholder="Target IP, host, or URL"
                disabled={isRunning}
              />
              <select
                value={newChallenge.difficulty}
                onChange={(event) => setNewChallenge((value) => ({ ...value, difficulty: event.target.value }))}
                disabled={isRunning}
              >
                <option>Custom</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
              <textarea
                value={newChallenge.description}
                onChange={(event) => setNewChallenge((value) => ({ ...value, description: event.target.value }))}
                placeholder="Optional challenge notes or goal"
                rows={3}
                disabled={isRunning}
              />
              <button className="btn-primary" onClick={addCustomChallenge} disabled={isRunning}>
                Add CTF
              </button>
            </div>
            {challengeError ? <p className="muted custom-error">{challengeError}</p> : null}
          </div>

          <div className="custom-command">
            <h3>Custom Docker Command</h3>
            <p className="muted">Runs your command in the backend Docker sandbox.</p>
            <label htmlFor="customCommand">Command</label>
            <textarea
              id="customCommand"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              rows={4}
              spellCheck={false}
              disabled={isRunning || isRunningCustom}
            />
            <div className="control-row actions">
              <button className="btn-primary" onClick={runCustom} disabled={isRunning || isRunningCustom}>
                {isRunningCustom ? 'Running...' : 'Run In Docker'}
              </button>
              <button
                onClick={() => {
                  setCustomResult(null)
                  setCustomError('')
                }}
                disabled={isRunning || isRunningCustom}
              >
                Clear Output
              </button>
            </div>

            {customError ? <p className="muted custom-error">{customError}</p> : null}

            {customResult ? (
              <div className="terminal custom-terminal">
                <div className="terminal-head">
                  <span />
                  <span />
                  <span />
                  <strong>custom-exec</strong>
                </div>
                <div className="terminal-body custom-terminal-body">
                  <p className="muted">
                    exit_code: <strong>{customResult.exit_code}</strong> | timed_out: <strong>{String(customResult.timed_out)}</strong> | mock:{' '}
                    <strong>{String(customResult.mock)}</strong>
                  </p>
                  <p className="terminal-line">
                    <span className="line-number">STDOUT</span>
                    <pre className="custom-pre">{customResult.stdout || '(no stdout)'}</pre>
                  </p>
                  <p className="terminal-line">
                    <span className="line-number">STDERR</span>
                    <pre className="custom-pre">{customResult.stderr || '(no stderr)'}</pre>
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )
    }

    if (sectionId === 'terminal-output') {
      return (
        <section className="single-view card">
          <h2>Live Terminal Output</h2>
          <div className="terminal">
            <div className="terminal-head">
              <span />
              <span />
              <span />
              <strong>hacksynth@simulator</strong>
            </div>
            <div className="terminal-body" ref={terminalBodyRef}>
              {logs.length === 0 ? (
                <p className="muted">No simulation output yet.</p>
              ) : (
                logs.map((line, index) => (
                  <p key={`${line}-${index}`} className="terminal-line">
                    <span className="line-number">{String(index + 1).padStart(2, '0')}</span>
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        </section>
      )
    }

    if (sectionId === 'command-timeline') {
      return (
        <section className="single-view card">
          <h2>Planner Command Timeline</h2>
          <div className="timeline">
            {history.length === 0 ? (
              <p className="muted">Planner steps will appear here after simulation starts.</p>
            ) : (
              history.map((item) => (
                <div key={item.step} className="timeline-item">
                  <p>
                    <strong>Step {item.step}</strong> - {item.planner}
                  </p>
                  <p className="muted">{item.summary}</p>
                </div>
              ))
            )}
          </div>
        </section>
      )
    }

    if (sectionId === 'result-snapshot') {
      return (
        <section className="single-view card">
          <h2>Result Snapshot</h2>
          <p>
            Target IP: <strong>{currentChallenge.environment}</strong>
          </p>
          <p>
            Difficulty: <strong>{currentChallenge.difficulty}</strong>
          </p>
          <p>
            Execution Errors: <strong>{stats.errors}</strong>
          </p>
          <p>
            Final Flag: {flag ? <code className="flag">{flag}</code> : <span className="muted">Not found yet</span>}
          </p>
          <button onClick={copyFlag} disabled={!flag}>
            Copy Final Flag
          </button>
          <button onClick={exportRunReport}>Export Report</button>
          {renderRunGraph()}
        </section>
      )
    }

    if (sectionId === 'technical-dossier') {
      return (
        <section className="single-view card">
          <h2>Technical Dossier</h2>
          <div className="tab-row">
            <button className={technicalTab === 'architecture' ? 'tab active' : 'tab'} onClick={() => setTechnicalTab('architecture')}>
              Architecture
            </button>
            <button className={technicalTab === 'api' ? 'tab active' : 'tab'} onClick={() => setTechnicalTab('api')}>
              API
            </button>
            <button className={technicalTab === 'safety' ? 'tab active' : 'tab'} onClick={() => setTechnicalTab('safety')}>
              Safety
            </button>
            <button className={technicalTab === 'evaluation' ? 'tab active' : 'tab'} onClick={() => setTechnicalTab('evaluation')}>
              Evaluation
            </button>
            <button className={technicalTab === 'stack' ? 'tab active' : 'tab'} onClick={() => setTechnicalTab('stack')}>
              Stack
            </button>
          </div>
          {renderTechnicalPanel()}
        </section>
      )
    }

    return (
      <section className="single-view card">
        <h2>Demo Checklist</h2>
        <p>- Select challenge and start simulation.</p>
        <p>- Show logs + planner timeline together.</p>
        <p>- Open Technical Dossier tabs for architecture and API.</p>
        <p>- Reveal final result roadmap and export report JSON.</p>
      </section>
    )
  }

  const renderTechnicalPanel = () => {
    if (technicalTab === 'architecture') {
      return (
        <div className="tech-panel">
          <h3>System Architecture</h3>
          <div className="pipeline">
            <span>React UI</span>
            <span>FastAPI</span>
            <span>Planner + Summarizer LLM</span>
            <span>Docker Executor</span>
            <span>Optional DB</span>
          </div>
          <p>Control plane is API-driven. Execution plane is sandboxed. Observability comes from structured logs and metrics.</p>
        </div>
      )
    }
    if (technicalTab === 'api') {
      return (
        <div className="tech-panel">
          <h3>Backend API Contract</h3>
          {API_ENDPOINTS.map((endpoint) => (
            <div key={endpoint.id} className="list-row">
              <strong>{endpoint.route}</strong>
              <span>{endpoint.note}</span>
            </div>
          ))}
        </div>
      )
    }
    if (technicalTab === 'safety') {
      return (
        <div className="tech-panel">
          <h3>Safety Controls</h3>
          {SAFETY_CONTROLS.map((control) => (
            <p key={control}>- {control}</p>
          ))}
        </div>
      )
    }
    if (technicalTab === 'evaluation') {
      return (
        <div className="tech-panel">
          <h3>Evaluation Metrics</h3>
          {EVALUATION.map((metric) => (
            <p key={metric}>- {metric}</p>
          ))}
        </div>
      )
    }
    return (
      <div className="tech-panel">
        <h3>Tech Stack</h3>
        {STACK.map((item) => (
          <p key={item}>- {item}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="workspace">
        <aside className="sidebar card">
          <h2>Navigation</h2>
          <p className="muted">Core run views</p>
          <div className="sidebar-search">
            <input
              value={sectionQuery}
              onChange={(event) => setSectionQuery(event.target.value)}
              placeholder="Search section..."
            />
          </div>
          <nav className="sidebar-links">
            {filteredSections.map((section) => (
              <NavLink key={section.id} to={section.path} className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}>
                <SidebarIcon type={section.icon} />
                <span>{section.label}</span>
              </NavLink>
            ))}
          </nav>
          <img src={agentNode} alt="HackSynth architecture preview" className="sidebar-image" />
        </aside>

        <div className="content-stack">
          <section className="card control-strip">
            <div className="control-strip-left">
              <strong>Quick Control</strong>
              <span className="muted">
                Status: {isRunning ? 'RUNNING' : 'IDLE'} | Step {stats.steps}/{stepTarget} | API:{' '}
                {backendHealth.ok ? 'connected' : 'offline'}
              </span>
            </div>
            <div className="control-strip-actions">
              <button className="btn-primary" onClick={startRun} disabled={isRunning}>
                Start Run
              </button>
              <button className="btn-warn" onClick={stopRun} disabled={!isRunning}>
                End Run
              </button>
              <button onClick={resetRun}>Reset</button>
            </div>
          </section>

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {SIDEBAR_SECTIONS.map((section) => (
              <Route key={section.id} path={section.path} element={renderSectionView(section.id)} />
            ))}
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default App
