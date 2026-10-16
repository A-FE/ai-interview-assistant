import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { studyAPI, jdAPI, postSSE } from '../api'
import { ChatWindow, type Message } from '../components/ChatWindow'
import type { StudyPlan, StudyStep, StepStatus } from '../types'

// ─── SSE helper for study plan ────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000'

async function fetchStudyPlan(
  jdSessionId: number,
  forceRefresh: boolean,
  onGenerating: () => void,
  onDone: (plan: StudyPlan, cached: boolean) => void,
): Promise<void> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`${API_BASE}/api/study/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jd_session_id: jdSessionId, force_refresh: forceRefresh }),
  })
  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6))
        if (payload.type === 'generating') onGenerating()
        if (payload.type === 'done') onDone(payload.plan as StudyPlan, payload.cached ?? false)
      } catch {
        // skip malformed
      }
    }
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '知识点':   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
  '算法题型': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  '项目方向': { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
}

const PRIORITY_STYLES: Record<string, string> = {
  '高': 'bg-red-50 text-red-600 border-red-200',
  '中': 'bg-amber-50 text-amber-600 border-amber-200',
  '低': 'bg-gray-50 text-gray-500 border-gray-200',
}

const STATUS_CONFIG: Record<StepStatus, { label: string; icon: string; color: string }> = {
  pending:      { label: '未开始', icon: '○',  color: 'text-gray-400' },
  mastered:     { label: '已掌握', icon: '✅', color: 'text-emerald-600' },
  needs_review: { label: '需复习', icon: '📖', color: 'text-amber-600' },
  skipped:      { label: '已跳过', icon: '⏭',  color: 'text-gray-400' },
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= level ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen({ generating }: { generating: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-indigo-600 font-medium">
          {generating ? 'AI 正在为你定制学习计划...' : '加载中...'}
        </p>
        {generating && (
          <p className="text-xs text-gray-400">这可能需要 10-30 秒，请稍候</p>
        )}
      </div>
    </div>
  )
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

function LeftSidebar({
  plan,
  progress,
  activeIdx,
  jdTitle,
  jdCompany,
  onSelectStep,
  onRefresh,
  onBack,
}: {
  plan: StudyPlan
  progress: Record<number, StepStatus>
  activeIdx: number
  jdTitle: string | null
  jdCompany: string | null
  onSelectStep: (idx: number) => void
  onRefresh: () => void
  onBack: () => void
}) {
  const doneCount = Object.values(progress).filter(
    (s) => s === 'mastered' || s === 'skipped',
  ).length
  const total = plan.steps.length
  const weaknessCount = plan.steps.filter((s) => s.is_weakness).length

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r border-gray-100 bg-white overflow-hidden">
      {/* Header: back + JD info */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors mb-2"
        >
          ← 返回
        </button>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate">
              {jdTitle ?? '复习计划'}
            </p>
            {jdCompany && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{jdCompany}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {plan.meta.total_steps} 个步骤 · 预计 {plan.meta.estimated_hours}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
            <button
              onClick={onRefresh}
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              🔄 重新生成
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>进度</span>
            <span className="font-medium text-indigo-600">{doneCount} / {total}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Weakness badge */}
        {weaknessCount > 0 && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              ⚠️ 历史薄弱点 · {weaknessCount}
            </span>
          </div>
        )}
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto py-1">
        {plan.steps.map((step, idx) => {
          const stepStatus = progress[step.index] ?? 'pending'
          const sc = STATUS_CONFIG[stepStatus]
          const s = CATEGORY_STYLES[step.category] ?? CATEGORY_STYLES['知识点']
          const isActive = idx === activeIdx

          return (
            <button
              key={step.index}
              onClick={() => onSelectStep(idx)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                isActive
                  ? 'bg-indigo-50 border-r-2 border-indigo-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Status icon */}
              <span className={`text-sm shrink-0 w-5 text-center ${sc.color}`}>{sc.icon}</span>

              {/* Step info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-medium ${isActive ? 'text-indigo-700' : 'text-gray-700'} truncate`}
                  >
                    {idx + 1}. {step.title}
                  </span>
                  {step.is_weakness && (
                    <span className="text-xs shrink-0">⚠️</span>
                  )}
                </div>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border mt-0.5 ${s.bg} ${s.text} ${s.border}`}>
                  {step.category}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

// ─── Right chat panel ─────────────────────────────────────────────────────────

function RightChatPanel({
  step,
  stepNum,
  total,
  jdSessionId,
  initialMessages,
  onStatusMark,
}: {
  step: StudyStep
  stepNum: number
  total: number
  jdSessionId: number
  initialMessages: Message[]
  onStatusMark: (status: Exclude<StepStatus, 'pending'>) => void
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const startedRef = useRef(false)

  const s = CATEGORY_STYLES[step.category] ?? CATEGORY_STYLES['知识点']
  const pStyle = PRIORITY_STYLES[step.priority] ?? PRIORITY_STYLES['中']

  const buildPayload = (msgs: Message[]) => ({
    messages: msgs
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content })),
    step: step as unknown as Record<string, unknown>,
  })

  const streamResponse = async (payload: object) => {
    const aiMsg: Message = { role: 'assistant', content: '', isStreaming: true }
    setMessages((prev) => [...prev, aiMsg])
    setIsStreaming(true)

    await postSSE(
      studyAPI.chatUrl(jdSessionId, step.index),
      payload,
      (chunk) =>
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + chunk }
          return updated
        }),
    )

    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false }
      return updated
    })
    setIsStreaming(false)
  }

  // Auto-trigger AI opening on first mount (no prior messages)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (initialMessages.length === 0) {
      streamResponse(buildPayload([]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = async (content: string) => {
    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages.filter((m) => !m.isStreaming), userMsg]
    setMessages(newMessages)
    await streamResponse(buildPayload(newMessages))
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
      {/* Step info bar */}
      <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm">
        {/* Header row */}
        <div className="px-5 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${s.bg} ${s.text} ${s.border}`}>
              {step.category}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${pStyle}`}>
              {step.priority}优先级
            </span>
            {step.is_weakness && (
              <span className="text-xs px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 font-medium">
                ⚠️ 历史薄弱点
              </span>
            )}
            <h2 className="text-sm font-bold text-gray-900 truncate">{step.title}</h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <DifficultyStars level={step.difficulty} />
            <span className="text-xs text-gray-400">{stepNum}/{total}</span>
          </div>
        </div>

        {/* Why important — always visible, with expandable detail toggle */}
        <div className="px-5 pb-3 border-t border-gray-50">
          <div className="bg-indigo-50 rounded-xl px-3 py-2.5 mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-indigo-500">💡 为什么重要</p>
              <button
                onClick={() => setDetailExpanded((v) => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
              >
                {detailExpanded ? '收起 ▲' : '查看详情 ▼'}
              </button>
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed">{step.why_important}</p>
            {detailExpanded && (
              <div className="mt-2 pt-2 border-t border-indigo-100">
                <ul className="space-y-1 pb-1">
                  {step.key_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-indigo-900">
                      <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
                {step.resources.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">参考资料</p>
                    <ul className="space-y-1">
                      {step.resources.map((r, i) => (
                        <li key={i} className="text-xs text-indigo-600 flex items-start gap-1.5">
                          <span className="mt-0.5 text-indigo-300">📎</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          onSend={handleSend}
          placeholder="输入你的想法，AI 会引导你深入理解..."
        />
      </div>

      {/* Status action bar */}
      <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-2.5 flex items-center gap-3">
        <span className="text-xs text-gray-400 shrink-0">学完后标记：</span>
        <div className="flex gap-2 flex-1">
          <button
            onClick={() => onStatusMark('mastered')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200 active:scale-95 transition-all duration-150"
          >
            <span>✅</span> 已掌握，下一个
          </button>
          <button
            onClick={() => onStatusMark('needs_review')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-semibold border border-amber-200 active:scale-95 transition-all duration-150"
          >
            <span>📖</span> 需要复习，下一个
          </button>
          <button
            onClick={() => onStatusMark('skipped')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl text-xs font-semibold border border-gray-200 active:scale-95 transition-all duration-150"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Summary screen ───────────────────────────────────────────────────────────

function SummaryScreen({
  plan,
  progress,
  jdSessionId,
}: {
  plan: StudyPlan
  progress: Record<number, StepStatus>
  jdSessionId: number
}) {
  const navigate = useNavigate()

  const mastered    = plan.steps.filter((s) => progress[s.index] === 'mastered')
  const needsReview = plan.steps.filter((s) => progress[s.index] === 'needs_review')
  const skipped     = plan.steps.filter((s) => progress[s.index] === 'skipped')
  const pending     = plan.steps.filter((s) => !progress[s.index] || progress[s.index] === 'pending')

  return (
    <div className="flex items-center justify-center h-full bg-gray-50/30">
      <div className="max-w-md w-full mx-4 space-y-4">
        {/* Completion header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">复习计划完成！</h2>
          <p className="text-sm text-gray-500">你已走完全部 {plan.steps.length} 个学习步骤</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '已掌握', count: mastered.length, icon: '✅', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: '需复习', count: needsReview.length, icon: '📖', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: '已跳过', count: skipped.length + pending.length, icon: '⏭', color: 'bg-gray-50 text-gray-600 border-gray-200' },
          ].map(({ label, count, icon, color }) => (
            <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Needs review list */}
        {needsReview.length > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">📌 重点复习清单</p>
            <ul className="space-y-1">
              {needsReview.map((step) => (
                <li key={step.index} className="text-sm text-amber-700 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                  {step.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate(`/interview?jd=${jdSessionId}`)}
          className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200"
        >
          🎯 开始模拟面试
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'generating' | 'ready' | 'summary'

export default function StudyPlan() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const jdSessionId = Number(searchParams.get('jd'))

  const [phase, setPhase]         = useState<Phase>('loading')
  const [plan, setPlan]           = useState<StudyPlan | null>(null)
  const [progress, setProgress]   = useState<Record<number, StepStatus>>({})
  const [activeIdx, setActiveIdx] = useState(0)
  const [, setFromCache] = useState(false)
  const [jdTitle, setJdTitle]     = useState<string | null>(null)
  const [jdCompany, setJdCompany] = useState<string | null>(null)
  // Per-step chat message history (preserved when switching between steps)
  const [chatMessages, setChatMessages] = useState<Record<number, Message[]>>({})

  const findStartStep = (p: StudyPlan, prog: Record<number, StepStatus>) => {
    const first = p.steps.findIndex(
      (s) => !prog[s.index] || prog[s.index] === 'pending',
    )
    return first === -1 ? 0 : first
  }

  const loadPlan = useCallback(
    async (forceRefresh = false) => {
      if (!jdSessionId) return
      setPhase(forceRefresh ? 'generating' : 'loading')
      if (forceRefresh) { setPlan(null); setChatMessages({}) }

      try {
        await fetchStudyPlan(
          jdSessionId,
          forceRefresh,
          () => setPhase('generating'),
          async (receivedPlan, cached) => {
            setPlan(receivedPlan)
            setFromCache(cached)
            try {
              const res = await studyAPI.getProgress(jdSessionId)
              const records: { step_index: number; status: StepStatus }[] = res.data
              const map: Record<number, StepStatus> = {}
              for (const r of records) map[r.step_index] = r.status
              setProgress(map)
              setActiveIdx(findStartStep(receivedPlan, map))
            } catch {
              setActiveIdx(0)
            }
            setPhase('ready')
          },
        )
      } catch {
        setPhase('ready')
      }
    },
    [jdSessionId],
  )

  useEffect(() => {
    loadPlan(false)
  }, [loadPlan])

  useEffect(() => {
    if (!jdSessionId) return
    jdAPI.getSession(jdSessionId)
      .then((res) => {
        setJdTitle(res.data.title ?? null)
        setJdCompany(res.data.company ?? null)
      })
      .catch(() => {})
  }, [jdSessionId])

  // Mark a step's status and advance to the next pending step
  const handleStatusMark = async (status: Exclude<StepStatus, 'pending'>) => {
    if (!plan) return
    const step = plan.steps[activeIdx]
    if (!step) return

    const newProgress = { ...progress, [step.index]: status }
    setProgress(newProgress)
    studyAPI.updateProgress(jdSessionId, step.index, status).catch(() => {})

    // Find next incomplete step
    const nextIdx = plan.steps.findIndex(
      (s, i) => i > activeIdx && (!newProgress[s.index] || newProgress[s.index] === 'pending'),
    )

    if (nextIdx === -1) {
      // Check if all steps are done
      const allDone = plan.steps.every(
        (s) => newProgress[s.index] && newProgress[s.index] !== 'pending',
      )
      if (allDone) {
        setPhase('summary')
      }
      // Otherwise stay on current step (user can pick manually)
    } else {
      setActiveIdx(nextIdx)
    }
  }

  // Save messages for a step when switching away
  const handleSelectStep = (idx: number) => {
    setActiveIdx(idx)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'loading' || phase === 'generating') {
    return (
      <div style={{ height: 'calc(100vh - 3.5rem)' }}>
        <LoadingScreen generating={phase === 'generating'} />
      </div>
    )
  }

  if (phase === 'summary' && plan) {
    return (
      <div style={{ height: 'calc(100vh - 3.5rem)' }}>
        <SummaryScreen plan={plan} progress={progress} jdSessionId={jdSessionId} />
      </div>
    )
  }

  if (!plan) return null

  const activeStep = plan.steps[activeIdx]

  return (
    <div className="flex" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Left sidebar */}
      <LeftSidebar
        plan={plan}
        progress={progress}
        activeIdx={activeIdx}
        jdTitle={jdTitle}
        jdCompany={jdCompany}
        onSelectStep={handleSelectStep}
        onRefresh={() => loadPlan(true)}
        onBack={() => navigate(`/jd/${jdSessionId}/analysis`)}
      />

      {/* Right chat panel */}
      {activeStep ? (
        <RightChatPanel
          key={activeIdx}
          step={activeStep}
          stepNum={activeIdx + 1}
          total={plan.steps.length}
          jdSessionId={jdSessionId}
          initialMessages={chatMessages[activeIdx] ?? []}
          onStatusMark={(status) => {
            // Snapshot messages before advancing
            setChatMessages((prev) => ({ ...prev, [activeIdx]: prev[activeIdx] ?? [] }))
            handleStatusMark(status)
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          请从左侧选择一个知识点开始学习
        </div>
      )}
    </div>
  )
}
