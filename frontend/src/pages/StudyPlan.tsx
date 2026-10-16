import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { studyAPI } from '../api'
import type { StudyPlan, StudyStep, StepStatus } from '../types'

// ─── SSE helper ──────────────────────────────────────────────────────────────

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
  '知识点':  { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
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

// ─── Phase: Loading / Generating ─────────────────────────────────────────────

function LoadingCard({ generating }: { generating: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
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

// ─── Phase: Overview ─────────────────────────────────────────────────────────

function OverviewCard({
  plan,
  progress,
  fromCache,
  onStart,
  onRefresh,
}: {
  plan: StudyPlan
  progress: Record<number, StepStatus>
  fromCache: boolean
  onStart: () => void
  onRefresh: () => void
}) {
  const doneCount = Object.values(progress).filter(
    (s) => s === 'mastered' || s === 'skipped',
  ).length
  const total = plan.steps.length
  const hasHistory = Object.keys(progress).length > 0
  const weaknessCount = plan.steps.filter((s) => s.is_weakness).length

  const categories = ['知识点', '算法题型', '项目方向'] as const
  const countByCategory = (cat: string) => plan.steps.filter((s) => s.category === cat).length

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">今日复习计划</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {plan.meta.total_steps} 个学习步骤 · 预计 {plan.meta.estimated_hours}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {fromCache && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" /> 已缓存
              </span>
            )}
            <button
              onClick={onRefresh}
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              🔄 重新生成
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {hasHistory && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>已完成</span>
              <span>{doneCount} / {total}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Category breakdown */}
        <div className="flex gap-2 flex-wrap mb-5">
          {categories.map((cat) => {
            const count = countByCategory(cat)
            if (count === 0) return null
            const s = CATEGORY_STYLES[cat]
            return (
              <span
                key={cat}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}
              >
                {cat} · {count}
              </span>
            )
          })}
          {weaknessCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              ⚠️ 历史薄弱点 · {weaknessCount}
            </span>
          )}
        </div>

        <button
          onClick={onStart}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-95 transition-all duration-200"
        >
          {hasHistory && doneCount > 0 ? '继续学习 →' : '开始学习 →'}
        </button>
      </div>

      {/* Step list preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">学习路径预览</p>
        </div>
        <div className="divide-y divide-gray-50">
          {plan.steps.map((step) => {
            const s = CATEGORY_STYLES[step.category] ?? CATEGORY_STYLES['知识点']
            const stepStatus = progress[step.index] ?? 'pending'
            const sc = STATUS_CONFIG[stepStatus]
            return (
              <div key={step.index} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-sm ${sc.color}`}>{sc.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{step.title}</span>
                    {step.is_weakness && (
                      <span className="text-xs text-amber-600">⚠️</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${s.bg} ${s.text} ${s.border} shrink-0`}>
                  {step.category}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Phase: Studying — single step card ──────────────────────────────────────

function StepCard({
  step,
  stepNum,
  total,
  onAction,
  onPrev,
}: {
  step: StudyStep
  stepNum: number
  total: number
  onAction: (status: Exclude<StepStatus, 'pending'>) => void
  onPrev: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const s = CATEGORY_STYLES[step.category] ?? CATEGORY_STYLES['知识点']
  const pStyle = PRIORITY_STYLES[step.priority] ?? PRIORITY_STYLES['中']

  return (
    <div className="space-y-4">
      {/* Progress row */}
      <div className="flex items-center gap-3">
        {stepNum > 1 ? (
          <button
            onClick={onPrev}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
          >
            ← 上一题
          </button>
        ) : (
          <span className="text-xs text-transparent select-none">← 上一题</span>
        )}
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="font-medium text-indigo-600">{stepNum} / {total}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${(stepNum / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${s.bg} ${s.text} ${s.border}`}>
            {step.category}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${pStyle}`}>
            {step.priority}优先级
          </span>
          {step.is_weakness && (
            <span className="text-xs px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 font-medium">
              ⚠️ 历史薄弱点
            </span>
          )}
          <span className="ml-auto">
            <DifficultyStars level={step.difficulty} />
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h2>

        {/* Why important */}
        <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs font-semibold text-indigo-500 mb-1">💡 为什么重要</p>
          <p className="text-sm text-indigo-800">{step.why_important}</p>
        </div>

        {/* Key points */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">核心要点</p>
          <ul className="space-y-1.5">
            {step.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Resources — collapsible */}
        {step.resources.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 hover:text-indigo-500 transition-colors"
            >
              参考资料 {expanded ? '▲' : '▼'}
            </button>
            {expanded && (
              <ul className="mt-2 space-y-1">
                {step.resources.map((r, i) => (
                  <li key={i} className="text-sm text-indigo-600 flex items-start gap-2">
                    <span className="mt-1 text-indigo-300">📎</span>{r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onAction('mastered')}
            className="flex flex-col items-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-semibold border border-emerald-200 active:scale-95 transition-all duration-150"
          >
            <span>✅</span>
            <span className="text-xs">已掌握</span>
          </button>
          <button
            onClick={() => onAction('needs_review')}
            className="flex flex-col items-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold border border-amber-200 active:scale-95 transition-all duration-150"
          >
            <span>📖</span>
            <span className="text-xs">需要复习</span>
          </button>
          <button
            onClick={() => onAction('skipped')}
            className="flex flex-col items-center gap-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl text-sm font-semibold border border-gray-200 active:scale-95 transition-all duration-150"
          >
            <span>⏭</span>
            <span className="text-xs">跳过</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Phase: Summary ───────────────────────────────────────────────────────────

function SummaryCard({
  plan,
  progress,
  jdSessionId,
}: {
  plan: StudyPlan
  progress: Record<number, StepStatus>
  jdSessionId: number
}) {
  const navigate = useNavigate()

  const mastered     = plan.steps.filter((s) => progress[s.index] === 'mastered')
  const needsReview  = plan.steps.filter((s) => progress[s.index] === 'needs_review')
  const skipped      = plan.steps.filter((s) => progress[s.index] === 'skipped')
  const pending      = plan.steps.filter((s) => !progress[s.index] || progress[s.index] === 'pending')

  return (
    <div className="space-y-4">
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
      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/interview?jd=${jdSessionId}`)}
          className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200"
        >
          🎯 开始模拟面试
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'generating' | 'overview' | 'studying' | 'summary'

export default function StudyPlan() {
  const [searchParams] = useSearchParams()
  const jdSessionId = Number(searchParams.get('jd'))

  const [phase, setPhase] = useState<Phase>('loading')
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [progress, setProgress] = useState<Record<number, StepStatus>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [fromCache, setFromCache] = useState(false)

  // Load plan + progress on mount
  const loadPlan = useCallback(
    async (forceRefresh = false) => {
      if (!jdSessionId) return
      setPhase(forceRefresh ? 'generating' : 'loading')
      if (forceRefresh) setPlan(null)

      try {
        await fetchStudyPlan(
          jdSessionId,
          forceRefresh,
          () => setPhase('generating'),
          async (receivedPlan, cached) => {
            setPlan(receivedPlan)
            setFromCache(cached)
            // Load existing progress from DB
            try {
              const res = await studyAPI.getProgress(jdSessionId)
              const records: { step_index: number; status: StepStatus }[] = res.data
              const map: Record<number, StepStatus> = {}
              for (const r of records) map[r.step_index] = r.status
              setProgress(map)
            } catch {
              // no progress yet — fine
            }
            setPhase('overview')
          },
        )
      } catch {
        setPhase('overview') // show whatever we have
      }
    },
    [jdSessionId],
  )

  useEffect(() => {
    loadPlan(false)
  }, [loadPlan])

  // Find the starting step (first non-completed, or 0)
  const findStartStep = (plan: StudyPlan, prog: Record<number, StepStatus>) => {
    const first = plan.steps.findIndex(
      (s) => !prog[s.index] || prog[s.index] === 'pending',
    )
    return first === -1 ? 0 : first
  }

  const handleStart = () => {
    if (!plan) return
    const start = findStartStep(plan, progress)
    setCurrentStep(start)
    setPhase('studying')
  }

  const handleAction = async (status: Exclude<StepStatus, 'pending'>) => {
    if (!plan) return
    const step = plan.steps[currentStep]
    if (!step) return

    // Optimistic update
    setProgress((prev) => ({ ...prev, [step.index]: status }))
    // Persist to backend (fire-and-forget, non-blocking)
    studyAPI.updateProgress(jdSessionId, step.index, status).catch(() => {})

    const next = currentStep + 1
    if (next >= plan.steps.length) {
      setPhase('summary')
    } else {
      setCurrentStep(next)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((n) => n - 1)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">个性化复习清单</h1>
        <p className="text-sm text-gray-400 mt-1">
          {phase === 'studying' && plan
            ? `逐步掌握每个知识点`
            : '基于 JD 要求生成精准复习计划'}
        </p>
      </div>

      {(phase === 'loading' || phase === 'generating') && (
        <LoadingCard generating={phase === 'generating'} />
      )}

      {phase === 'overview' && plan && (
        <OverviewCard
          plan={plan}
          progress={progress}
          fromCache={fromCache}
          onStart={handleStart}
          onRefresh={() => loadPlan(true)}
        />
      )}

      {phase === 'studying' && plan && plan.steps[currentStep] && (
        <StepCard
          step={plan.steps[currentStep]}
          stepNum={currentStep + 1}
          total={plan.steps.length}
          onAction={handleAction}
          onPrev={handlePrev}
        />
      )}

      {phase === 'summary' && plan && (
        <SummaryCard
          plan={plan}
          progress={progress}
          jdSessionId={jdSessionId}
        />
      )}
    </div>
  )
}
