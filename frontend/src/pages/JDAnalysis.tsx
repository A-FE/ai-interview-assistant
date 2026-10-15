import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jdAPI, resumeAPI, postSSE } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { JDSession, JDSummary, Resume } from '../types'

function parseSummary(raw: string | null): JDSummary | null {
  if (!raw) return null
  try { return JSON.parse(raw) as JDSummary } catch { return null }
}

// ── Section icons + gap detection ────────────────────────────────────────────

const SECTION_ICONS: [RegExp, string][] = [
  [/技术栈|技术要求|技能|stack/i, '🛠️'],
  [/薄弱|弱点|不足|gap|差距/i, '⚠️'],
  [/亮点|优势|优秀|highlight|已符合/i, '✅'],
  [/代码|编程|算法|program/i, '💻'],
  [/总结|综合|整体|概述|summary/i, '📋'],
  [/建议|提升|改进|后续|suggest/i, '🎯'],
  [/沟通|表达|软技能/i, '💬'],
  [/系统设计|架构|design/i, '🏗️'],
  [/项目|经验|project/i, '📁'],
  [/薪资|待遇|salary/i, '💰'],
  [/岗位|职位|job|硬性/i, '📌'],
  [/考察|面试|频率/i, '🔍'],
  [/匹配|评分|分数/i, '📊'],
]

// Sections matching these patterns are visually de-emphasized (already met)
const MATCH_RE = /已符合|已匹配|亮点|优势/i
// Sections matching these are highlighted as important gaps
const GAP_RE = /差距|薄弱|弱点|不足|gap|待提升|需补强/i

function getSectionIcon(title: string): string {
  for (const [re, icon] of SECTION_ICONS) {
    if (re.test(title)) return icon
  }
  return '📄'
}

interface Section {
  id: string
  title: string
  content: string
  icon: string
  level: number   // 1 | 2 | 3
  isGap: boolean
  isMatch: boolean
}

function parseMarkdownSections(md: string): Section[] {
  const lines = md.split('\n')
  const sections: Section[] = []
  let cur: { title: string; lines: string[]; level: number } | null = null

  const flush = () => {
    if (!cur) return
    sections.push({
      id: `sec-${sections.length}`,
      title: cur.title,
      content: cur.lines.join('\n').trim(),
      icon: getSectionIcon(cur.title),
      level: cur.level,
      isGap: GAP_RE.test(cur.title),
      isMatch: MATCH_RE.test(cur.title),
    })
    cur = null
  }

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (m) { flush(); cur = { title: m[2].trim(), lines: [line], level: m[1].length } }
    else if (cur) cur.lines.push(line)
  }
  flush()
  return sections
}

// ── Resume selector (pick from user's ready resumes) ─────────────────────────

function ResumeSelector({
  resumes,
  selectedId,
  onChange,
}: {
  resumes: Resume[]
  selectedId: number | null
  onChange: (id: number) => void
}) {
  const ready = resumes.filter((r) => r.status === 'done')
  if (ready.length === 0) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 shrink-0">使用简历</span>
      <select
        value={selectedId ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 max-w-[200px]"
      >
        {ready.map((r) => (
          <option key={r.id} value={r.id}>{r.filename}</option>
        ))}
      </select>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function JDAnalysis() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<JDSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Deep analysis state
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [streamText, setStreamText] = useState('')

  // Load session + resume list in parallel
  useEffect(() => {
    if (!id) {
      setError('无效的 JD ID')
      setLoading(false)
      return
    }
    Promise.all([
      jdAPI.getSession(Number(id)),
      resumeAPI.list(),
    ])
      .then(([sessionRes, resumeRes]) => {
        setSession(sessionRes.data)
        const list: Resume[] = resumeRes.data
        setResumes(list)
        const ready = list.filter((r) => r.status === 'done')
        if (ready.length > 0) setSelectedResumeId(ready[0].id)
      })
      .catch(() => setError('加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [id])

  // ── Scroll spy ────────────────────────────────────────────────────────────
  const setupObserver = useCallback((sections: Section[]) => {
    observerRef.current?.disconnect()
    const ratios = new Map<string, number>()
    observerRef.current = new IntersectionObserver(
      (obs) => {
        obs.forEach((e) => ratios.set(e.target.id, e.intersectionRatio))
        let best = ''; let bestR = -1
        ratios.forEach((r, eid) => { if (r > bestR) { bestR = r; best = eid } })
        if (best) setActiveId(best)
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    )
    sections.forEach(({ id: sid }) => {
      const el = document.getElementById(sid)
      if (el) observerRef.current!.observe(el)
    })
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  // Re-init observer after analysis completes or session loads
  const analysisContent = session?.analysis_result ?? streamText
  useEffect(() => {
    if (!analysisContent) return
    const sections = parseMarkdownSections(analysisContent)
    if (sections.length === 0) return
    setActiveId(sections[0].id)
    const raf = requestAnimationFrame(() => setupObserver(sections))
    return () => cancelAnimationFrame(raf)
  }, [analysisContent, setupObserver])

  // ── Deep analysis trigger ─────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!session || !selectedResumeId || analyzing) return
    setAnalyzing(true)
    setAnalyzeError('')
    setStreamText('')
    // Clear existing report so old content is hidden while regenerating
    setSession((prev) => prev ? { ...prev, analysis_result: null } : prev)

    // Use a local accumulator to avoid stale closure in onDone
    let accumulated = ''

    try {
      await postSSE(
        jdAPI.analyzeSessionUrl(session.id),
        { resume_id: selectedResumeId },
        (chunk) => {
          accumulated += chunk
          setStreamText(accumulated)
        },
        (extra) => {
          if (extra?.type === 'done') {
            const jd_summary = extra.jd_summary as any
            // Replace old report with the newly generated one
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    analysis_result: accumulated,
                    jd_summary: JSON.stringify(jd_summary),
                  }
                : prev
            )
          }
        },
      )
      // Fallback: server didn't send done event
      setSession((prev) =>
        prev && !prev.analysis_result
          ? { ...prev, analysis_result: accumulated }
          : prev
      )
    } catch {
      setAnalyzeError('分析请求失败，请稍后重试')
    } finally {
      setAnalyzing(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400 gap-3">
      <span className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-sm">加载中...</span>
    </div>
  )

  if (error || !session) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">
      <div className="text-4xl mb-4 opacity-30">😕</div>
      <p>{error || '加载失败'}</p>
      <button onClick={() => navigate(-1)} className="mt-4 text-sm text-indigo-600 hover:underline">← 返回</button>
    </div>
  )

  const summary = parseSummary(session.jd_summary)
  const title = session.title || summary?.title || '未识别岗位'
  const company = session.company || summary?.company
  const matchScore = summary?.match_score
  const scoreRing =
    matchScore == null ? ''
    : matchScore >= 80 ? 'ring-emerald-300 text-emerald-600 bg-emerald-50'
    : matchScore >= 60 ? 'ring-amber-300 text-amber-600 bg-amber-50'
    : 'ring-red-300 text-red-500 bg-red-50'

  const displayContent = session.analysis_result ?? (analyzing ? streamText : '')
  const sections = parseMarkdownSections(displayContent)

  const readyResumes = resumes.filter((r) => r.status === 'done')
  const hasReadyResume = readyResumes.length > 0

  // scroll-mt accounts for: global Header 56px + action bar ~52px + gap
  const scrollTo = (sid: string) => {
    const el = document.getElementById(sid)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 116
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* ── Action bar (breadcrumb) — sticky below the global Header ─────── */}
      <div className="sticky top-14 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
          >← 返回</button>
          <div className="flex-1 min-w-0 px-3 border-l border-gray-200 flex items-center gap-3 flex-wrap">
            {company && <p className="text-sm text-gray-500">{company}</p>}
            {summary?.city && (
              <span className="text-sm text-gray-500">📍 {summary.city}</span>
            )}
            {summary?.level && (
              <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">{summary.level}</span>
            )}
            {!summary?.salary && !summary?.city && !summary?.level && (
              <span className="text-sm text-gray-400">{title}</span>
            )}
            {summary?.salary && (
              <span className="text-sm font-bold text-red-500">{summary.salary}</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => navigate(`/study?jd=${session.id}`)}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >📚 复习清单</button>
            <button
              onClick={() => navigate(`/interview?jd=${session.id}`)}
              className="px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-xl hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
            >🎯 模拟面试</button>
          </div>
        </div>
      </div>

      {/* ── Body: left TOC + right content ───────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-6 items-start">

        {/* ── Left sidebar TOC ─────────────────────────────────────────────── */}
        {sections.length > 1 && (
          <aside className="hidden lg:block w-52 shrink-0 sticky top-[108px] self-start">
            <nav className="flex flex-col">
              {sections.map((sec) => {
                const active = activeId === sec.id
                const indentPx = (sec.level - 1) * 12
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    style={{ paddingLeft: `${12 + indentPx}px` }}
                    className={`group flex items-center gap-2 pr-3 py-1.5 rounded-lg text-left transition-all duration-150 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : sec.isGap
                          ? 'text-orange-600 hover:bg-orange-50'
                          : sec.isMatch
                            ? 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <span className={`w-0.5 rounded-full shrink-0 transition-all duration-150 ${
                      active ? 'bg-indigo-500' : sec.isGap ? 'bg-orange-300' : 'bg-transparent group-hover:bg-gray-300'
                    } ${sec.level === 1 ? 'h-4' : 'h-3'}`} />
                    <span className={`leading-snug truncate ${
                      sec.level === 1
                        ? `text-sm ${active ? 'font-semibold' : sec.isGap ? 'font-semibold' : 'font-medium'}`
                        : `text-xs ${active ? 'font-medium' : 'font-normal'} opacity-90`
                    }`}>
                      {sec.title}
                    </span>
                  </button>
                )
              })}
            </nav>
          </aside>
        )}

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ── No analysis yet — CTA ──────────────────────────────────────── */}
          {!session.analysis_result && !analyzing && (
            <div className="bg-white border border-gray-100 rounded-3xl p-10 shadow-sm">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-md mb-4">🔬</div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">深度 AI 分析</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  上传简历后，AI 将重点分析你与该岗位的<span className="font-semibold text-orange-500">能力差距</span>，帮你制定针对性提升计划
                </p>
              </div>

              {hasReadyResume ? (
                <div className="flex flex-col items-center gap-4">
                  <ResumeSelector
                    resumes={resumes}
                    selectedId={selectedResumeId}
                    onChange={setSelectedResumeId}
                  />
                  {analyzeError && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span>{analyzeError}</p>
                  )}
                  <button
                    onClick={handleAnalyze}
                    disabled={!selectedResumeId}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                  >
                    🔬 开始深度分析
                  </button>
                  <p className="text-xs text-gray-400">分析需要约 30–60 秒，将以流式方式实时展示</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-center max-w-sm">
                    <p className="text-sm font-semibold text-amber-700 mb-1">⚠️ 需要先上传简历</p>
                    <p className="text-xs text-amber-600">深度分析需要对比你的简历与 JD，才能找出具体差距</p>
                  </div>
                  <button
                    onClick={() => navigate('/resume')}
                    className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 active:scale-95 transition-all"
                  >
                    📄 前往上传简历
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Streaming in progress ─────────────────────────────────────── */}
          {analyzing && (
            <div className="bg-white border border-indigo-100 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin shrink-0" />
                <span className="text-sm font-semibold text-indigo-700">AI 正在深度分析中...</span>
                <span className="text-xs text-gray-400 ml-auto animate-pulse">重点关注能力差距</span>
              </div>
              {streamText && (
                <div className="prose prose-sm max-w-none">
                  <MarkdownRenderer content={streamText} />
                </div>
              )}
            </div>
          )}

          {/* ── Analysis result ────────────────────────────────────────────── */}
          {(session.analysis_result || (!analyzing && streamText)) && (
            <>
              <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-base shadow-sm shrink-0">🔬</div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">深度分析报告</h2>
                  <p className="text-xs text-gray-400">基于简历与 JD 对比分析，重点展示能力差距</p>
                </div>
                {matchScore != null && (
                  <span className={`shrink-0 w-14 h-14 rounded-full ring-2 flex items-center justify-center text-lg font-bold ${scoreRing}`}>
                    {matchScore}
                  </span>
                )}
                {/* 重新生成 — always visible when report exists */}
                {!analyzing && (
                  <div className="flex items-center gap-2 shrink-0">
                    {hasReadyResume ? (
                      <>
                        <ResumeSelector
                          resumes={resumes}
                          selectedId={selectedResumeId}
                          onChange={setSelectedResumeId}
                        />
                        <button
                          onClick={handleAnalyze}
                          disabled={!selectedResumeId}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          🔄 重新生成
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => navigate('/resume')}
                        className="px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 active:scale-95 transition-all whitespace-nowrap"
                      >
                        📄 上传简历后重新生成
                      </button>
                    )}
                  </div>
                )}
              </div>

              {sections.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      id={sec.id}
                      className={`rounded-2xl overflow-hidden border transition-all ${
                        sec.isGap
                          ? 'border-orange-200 bg-orange-50/40 shadow-[0_1px_4px_rgba(251,146,60,0.12)]'
                          : sec.isMatch
                            ? 'border-gray-100 bg-gray-50/60 opacity-80'
                            : 'border-gray-100 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
                      }`}
                    >
                      {sec.isGap && (
                        <div className="px-5 py-2 bg-orange-100/60 border-b border-orange-200/60 flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">⚠️ 重点补强区域</span>
                        </div>
                      )}
                      {sec.isMatch && (
                        <div className="px-5 py-2 bg-gray-100/60 border-b border-gray-100 flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">✅ 已符合（略）</span>
                        </div>
                      )}
                      <div className={`px-6 py-5 ${sec.isMatch ? 'py-3' : ''}`}>
                        <MarkdownRenderer content={sec.content} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border-[0.5px] border-gray-100 rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
                  <div className="px-8 py-6">
                    <MarkdownRenderer content={session.analysis_result ?? streamText} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
