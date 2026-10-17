import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportAPI } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { InterviewReport } from '../types'

// ── Section icons by keyword ─────────────────────────────────────────────────
const SECTION_ICONS: [RegExp, string][] = [
  [/技术栈|技术要求|技能/, '🛠️'],
  [/薄弱|弱点|不足/, '⚠️'],
  [/亮点|优势|优秀|表现/, '✨'],
  [/代码|编程|算法/, '💻'],
  [/总结|综合|整体|概述/, '📋'],
  [/建议|提升|改进|后续/, '🎯'],
  [/沟通|表达|软技能/, '💬'],
  [/系统设计|架构/, '🏗️'],
  [/项目|经验/, '📁'],
]

function getSectionIcon(title: string): string {
  for (const [re, icon] of SECTION_ICONS) {
    if (re.test(title)) return icon
  }
  return '📄'
}

// ── Parse markdown into sections by level-1/2 headings ──────────────────────
interface Section {
  id: string
  title: string
  content: string
  icon: string
}

function parseMarkdownSections(md: string): Section[] {
  const lines = md.split('\n')
  const sections: Section[] = []
  let cur: { title: string; lines: string[] } | null = null

  const flush = () => {
    if (!cur) return
    const id = `sec-${sections.length}`
    sections.push({
      id,
      title: cur.title,
      content: cur.lines.join('\n').trim(),
      icon: getSectionIcon(cur.title),
    })
    cur = null
  }

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/)
    if (m) {
      flush()
      cur = { title: m[2].trim(), lines: [line] }
    } else {
      if (cur) cur.lines.push(line)
    }
  }
  flush()
  return sections
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Report() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string>('')
  const tocRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    reportAPI.get(Number(id))
      .then((res) => setReport(res.data))
      .catch(() => navigate('/user'))
      .finally(() => setLoading(false))
  }, [id])

  // ── Derive sections (safe when report is null) ─────────────────────────────
  const sections = useMemo(
    () => (report ? parseMarkdownSections(report.report_json) : []),
    [report?.report_json],
  )

  // ── Scroll spy via IntersectionObserver ────────────────────────────────────
  const observerRef = useRef<IntersectionObserver | null>(null)

  const setupObserver = useCallback((sections: Section[]) => {
    observerRef.current?.disconnect()
    const entries = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      (obs) => {
        obs.forEach((e) => entries.set(e.target.id, e.intersectionRatio))
        // pick the section with highest visible ratio
        let best = ''
        let bestRatio = -1
        entries.forEach((ratio, eid) => {
          if (ratio > bestRatio) { bestRatio = ratio; best = eid }
        })
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

  // ── Sync TOC scroll when active changes ────────────────────────────────────
  useEffect(() => {
    if (!activeId || !tocRef.current) return
    const btn = tocRef.current.querySelector<HTMLElement>(`[data-sec="${activeId}"]`)
    btn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeId])

  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sections.length === 0) return
    setActiveId(sections[0].id)
    // Wait one frame so the DOM cards are rendered before observing
    const raf = requestAnimationFrame(() => setupObserver(sections))
    return () => cancelAnimationFrame(raf)
  }, [sections, setupObserver])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
        <span className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    )
  }
  if (!report) return null

  const score = report.overall_score
  const scoreColor = score == null ? '' : score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-red-500'
  const scoreBg   = score == null ? '' : score >= 80 ? 'bg-emerald-50 border-emerald-100' : score >= 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
  const scoreLabel = score == null ? '' : score >= 80 ? '优秀' : score >= 60 ? '良好' : '待提升'

  const scrollTo = (sid: string) => {
    const el = document.getElementById(sid)
    if (!el) return
    // offset = header 56px + toc bar 48px + 8px gap
    const y = el.getBoundingClientRect().top + window.scrollY - 116
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">面试评估报告</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(report.created_at).toLocaleString('zh-CN')}
          </p>
        </div>
        {score != null && (
          <div className={`flex flex-col items-center px-5 py-3 rounded-2xl border ${scoreBg} shrink-0`}>
            <span className={`text-3xl font-extrabold ${scoreColor}`}>{score}</span>
            <span className={`text-xs font-medium mt-0.5 ${scoreColor}`}>{scoreLabel}</span>
          </div>
        )}
      </div>

      {/* ── Weak points banner ──────────────────────────────────────────── */}
      {report.weak_points_summary && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-700 mb-1">薄弱知识点（下次面试将重点考察）</p>
            <p className="text-sm text-amber-600 leading-relaxed">{report.weak_points_summary}</p>
          </div>
        </div>
      )}

      {/* ── Sticky TOC nav bar ──────────────────────────────────────────── */}
      {sections.length > 1 && (
        <div className="sticky top-14 z-40 -mx-4 px-4 py-2 bg-white/90 backdrop-blur-md border-b border-gray-100 mb-6">
          <div
            ref={tocRef}
            className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5"
            style={{ scrollbarWidth: 'none' }}
          >
            {sections.map((sec) => {
              const active = activeId === sec.id
              return (
                <button
                  key={sec.id}
                  data-sec={sec.id}
                  onClick={() => scrollTo(sec.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  <span>{sec.icon}</span>
                  <span>{sec.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Section cards ───────────────────────────────────────────────── */}
      {sections.length > 0 ? (
        <div className="flex flex-col gap-4 mb-6">
          {sections.map((sec) => (
            <div
              key={sec.id}
              id={sec.id}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden scroll-mt-28"
            >
              {/* Card header */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50 bg-gray-50/60">
                <span className="text-base">{sec.icon}</span>
                <h2 className="text-sm font-semibold text-gray-700">{sec.title}</h2>
              </div>
              {/* Card body */}
              <div className="px-5 py-4">
                <MarkdownRenderer content={sec.content} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Fallback: render as single card if no headings found */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
          <MarkdownRenderer content={report.report_json} />
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => navigate(`/study?jd=${report.jd_session_id}`)}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all duration-200 shadow-sm"
        >
          📚 生成针对性复习清单
        </button>
        <button
          onClick={() => navigate(`/interview?jd=${report.jd_session_id}`)}
          className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200 shadow-sm"
        >
          🎯 二次模拟面试（薄弱点优先）
        </button>
        <button
          onClick={() => navigate('/user')}
          className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all duration-200"
        >
          用户中心
        </button>
      </div>
    </div>
  )
}
