import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jdAPI } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { JDSession, JDSummary } from '../types'

function parseSummary(raw: string | null): JDSummary | null {
  if (!raw) return null
  try { return JSON.parse(raw) as JDSummary } catch { return null }
}

// ── Section icons by keyword ─────────────────────────────────────────────────
const SECTION_ICONS: [RegExp, string][] = [
  [/技术栈|技术要求|技能|stack/i, '🛠️'],
  [/薄弱|弱点|不足|gap/i, '⚠️'],
  [/亮点|优势|优秀|highlight/i, '✨'],
  [/代码|编程|算法|program/i, '💻'],
  [/总结|综合|整体|概述|summary/i, '📋'],
  [/建议|提升|改进|后续|suggest/i, '🎯'],
  [/沟通|表达|软技能/i, '💬'],
  [/系统设计|架构|design/i, '🏗️'],
  [/项目|经验|project/i, '📁'],
  [/薪资|待遇|salary/i, '💰'],
  [/岗位|职位|job/i, '📌'],
]

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

// ─────────────────────────────────────────────────────────────────────────────

export default function JDAnalysis() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<JDSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!id) {
      setError('无效的 JD ID')
      setLoading(false)
      return
    }
    jdAPI.getSession(Number(id))
      .then((res) => setSession(res.data))
      .catch(() => setError('JD 不存在或无权访问'))
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

  // ── Init observer once session loads ─────────────────────────────────────
  useEffect(() => {
    if (!session?.analysis_result) return
    const sections = parseMarkdownSections(session.analysis_result)
    if (sections.length === 0) return
    setActiveId(sections[0].id)
    const raf = requestAnimationFrame(() => setupObserver(sections))
    return () => cancelAnimationFrame(raf)
  }, [session?.analysis_result, setupObserver])

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

  const sections = parseMarkdownSections(session.analysis_result ?? '')

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

        {/* ── Left sidebar TOC — sticky below Header + action bar ─────────── */}
        {sections.length > 1 && (
          <aside className="hidden lg:block w-52 shrink-0 sticky top-[108px] self-start">
<nav className="flex flex-col">
              {sections.map((sec) => {
                const active = activeId === sec.id
                // indent: h1 → 0, h2 → 12px, h3 → 24px
                const indentPx = (sec.level - 1) * 12
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    style={{ paddingLeft: `${12 + indentPx}px` }}
                    className={`group flex items-center gap-2 pr-3 py-1.5 rounded-lg text-left transition-all duration-150 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    {/* Active indicator bar */}
                    <span className={`w-0.5 rounded-full shrink-0 transition-all duration-150 ${
                      active ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-gray-300'
                    } ${sec.level === 1 ? 'h-4' : 'h-3'}`} />
                    <span className={`leading-snug truncate ${
                      sec.level === 1
                        ? `text-sm ${active ? 'font-semibold' : 'font-medium'}`
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

          {/* Analysis section */}
          {session.analysis_result ? (
            <>
              <div className="flex items-center gap-3 px-1">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-base shadow-sm shrink-0">🔬</div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">深度分析报告</h2>
                  <p className="text-xs text-gray-400">由 AI 自动生成，基于岗位描述综合分析</p>
                </div>
              </div>

              {sections.length > 0 ? (
                <div className="flex flex-col">
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      id={sec.id}
                    >
                        <MarkdownRenderer content={sec.content} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border-[0.5px] border-gray-100 rounded-3xl shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
                  <div className="px-8 py-6">
                    <MarkdownRenderer content={session.analysis_result} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-100 rounded-3xl p-16 shadow-sm text-center">
              <div className="text-5xl mb-4 opacity-20">🔬</div>
              <p className="text-gray-500 font-medium mb-2">暂无分析结果</p>
              <p className="text-sm text-gray-400">请先在工作机会页面解析此 JD</p>
              <button
                onClick={() => navigate('/jd')}
                className="mt-6 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
              >前往工作机会</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
