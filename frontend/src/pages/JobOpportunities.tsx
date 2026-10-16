import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { jdAPI } from '../api'
import type { JDSession, JDSummary } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSummary(raw: string | null): JDSummary | null {
  if (!raw) return null
  try { return JSON.parse(raw) as JDSummary } catch { return null }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── AddJDModal ────────────────────────────────────────────────────────────────

function AddJDModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (session: JDSession) => void
}) {
  const [jdText, setJdText] = useState('')
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [error, setError] = useState('')
  const [dupId, setDupId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setOcrError('请上传图片文件（PNG / JPG / WebP）')
      return
    }
    setOcrError('')
    setOcrLoading(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await jdAPI.ocr(base64, file.type)
      const text: string = res.data.text || ''
      if (!text.trim()) {
        setOcrError('未能从图片中提取到文字，请尝试更清晰的截图')
        return
      }
      setJdText(text)
    } catch (e: any) {
      setOcrError(e?.response?.data?.detail || 'OCR 识别失败，请稍后重试')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSave = async () => {
    if (!jdText.trim()) return
    setSaving(true)
    setError('')
    setDupId(null)
    try {
      const res = await jdAPI.createSession(jdText)
      onCreated(res.data)
      onClose()
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      if (e?.response?.status === 409 && typeof detail === 'object' && detail?.type === 'duplicate') {
        setDupId(detail.session_id as number)
      } else {
        setError(detail || '保存失败，请稍后重试')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">添加职位</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">粘贴 JD 文字，或上传招聘截图</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading || saving}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50"
            >
              {ocrLoading
                ? <><span className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />识别中...</>
                : <><span>🖼️</span> 上传截图</>}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = '' }} />
          </div>

          {ocrError && (
            <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span>{ocrError}</p>
          )}

          {dupId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              <span>⚠️</span>
              <span>检测到相似度 &gt;90% 的重复 JD，已跳过创建。</span>
              <button onClick={() => { onClose(); navigate(`/jd/${dupId}`) }} className="underline font-medium hover:text-amber-900 whitespace-nowrap">查看已有记录</button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1"><span>⚠️</span>{error}</p>
          )}

          <div
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleImageUpload(f) }}
            onDragOver={(e) => e.preventDefault()}
            className="relative"
          >
            <textarea
              autoFocus
              className="w-full h-48 border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all resize-none placeholder:text-gray-400"
              placeholder="粘贴职位描述（JD）到此处，或将截图拖拽到这里..."
              value={jdText}
              onChange={(e) => { setJdText(e.target.value); setDupId(null); setError('') }}
            />
            {ocrLoading && (
              <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                <span className="text-xs text-indigo-600 flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  正在识别截图文字...
                </span>
              </div>
            )}
          </div>

          {jdText && !ocrLoading && (
            <p className="text-xs text-gray-400">{jdText.length} 字 · 添加后可在详情页进行深度 AI 分析</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || ocrLoading || !jdText.trim()}
            className="flex-2 flex-grow py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-100"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />保存中...</>
              : '＋ 添加 JD'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── JDListItem ────────────────────────────────────────────────────────────────

function JDListItem({
  session,
  selected,
  onClick,
}: {
  session: JDSession
  selected: boolean
  onClick: () => void
}) {
  const summary = parseSummary(session.jd_summary)
  const title = session.title || summary?.title || '未识别岗位'
  const company = session.company || summary?.company
  const matchScore = summary?.match_score
  const scoreCls =
    matchScore == null ? 'bg-gray-100 text-gray-400'
    : matchScore >= 80 ? 'bg-gray-100 text-gray-500'
    : matchScore >= 60 ? 'bg-gray-100 text-gray-500'
    : 'bg-gray-100 text-gray-400'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 ${
        selected
          ? 'bg-white ring-1 ring-indigo-400 shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
          : 'bg-white border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-indigo-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)]'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>
            {title}
          </p>
          {company && <p className="text-xs text-gray-400 truncate mt-0.5">{company}</p>}
          {summary?.salary && (
            <p className="text-xs font-bold text-red-500 mt-1">{summary.salary}</p>
          )}
        </div>
        {matchScore != null && (
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${scoreCls}`}>
            {matchScore}
          </span>
        )}
      </div>
    </button>
  )
}

// ── JDDetailPanel ─────────────────────────────────────────────────────────────

function JDDetailPanel({
  session,
}: {
  session: JDSession
}) {
  const navigate = useNavigate()
  const summary = parseSummary(session.jd_summary)
  const title = session.title || summary?.title || '未识别岗位'
  const company = session.company || summary?.company

  return (
    <div className="h-full overflow-y-auto min-h-0">
      <div className="bg-white border-[0.5px] border-gray-100 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
        {/* Sticky header inside the card */}
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl px-7 pt-6 pb-4 border-b border-gray-50">
          <div className="flex items-center gap-4 mb-1">
            <h2 className="flex-1 min-w-0 text-xl font-bold text-gray-900 leading-snug">{title}</h2>
            <button
              onClick={() => navigate(`/jd/${session.id}/analysis`)}
              className="shrink-0 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 active:scale-95 transition-all border border-indigo-100"
            >🔬 深度分析</button>
          </div>

          {company && <p className="text-sm text-gray-500 mb-2">🏢 {company}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            {summary?.level && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium">{summary.level}</span>
            )}
            {summary?.city && <span className="text-xs text-gray-400">📍 {summary.city}</span>}
            {summary?.education && <span className="text-xs text-gray-400">🎓 {summary.education}</span>}
            {summary?.salary && <span className="text-sm font-bold text-red-500">{summary.salary}</span>}
          </div>
        </div>

        {/* Tech chips + JD text — scrolls with card */}
        <div className="px-7 py-5">
          {summary && summary.core_stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {summary.core_stack.map((tech, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg font-medium">
                  {tech}
                </span>
              ))}
            </div>
          )}

          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">原始 JD</p>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed font-sans">{session.jd_text}</pre>
          <p className="text-[11px] text-gray-300 mt-4">添加于 {new Date(session.created_at).toLocaleString('zh-CN')}</p>
        </div>
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function JobOpportunities() {
  const [sessions, setSessions] = useState<JDSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    jdAPI.listSessions()
      .then((res) => {
        const data: JDSession[] = res.data
        setSessions(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleCreated = (session: JDSession) => {
    setSessions((prev) => [session, ...prev])
    setSelectedId(session.id)
  }

  const filtered = sessions.filter((s) => {
    const summary = parseSummary(s.jd_summary)
    const title = s.title || summary?.title || ''
    const company = s.company || summary?.company || ''
    const stack = summary?.core_stack.join(' ') || ''
    const needle = searchText.toLowerCase()
    return !needle ||
      title.toLowerCase().includes(needle) ||
      company.toLowerCase().includes(needle) ||
      stack.toLowerCase().includes(needle) ||
      s.jd_text.toLowerCase().includes(needle)
  })

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-gray-50/80 py-2">
      {/* Top bar — 与全站 Header 风格对齐，无重复标题感 */}
      <div className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-100/80">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-700">职位分析</span>
            {sessions.length > 0 && (
              <span className="text-xs text-gray-400">· {sessions.length} 个岗位</span>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 active:scale-95 transition-all"
          >＋ 添加 JD</button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 max-w-6xl w-full mx-auto gap-5 px-6 py-5">
        {/* Left: job list — 固定，不随内容滚动 */}
        <div className="w-68 shrink-0 flex flex-col min-h-0">
          {/* Search */}
          <div className="relative mb-3 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="搜索岗位、公司、技术栈..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border-[0.5px] border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder:text-gray-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors text-xs"
              >✕</button>
            )}
          </div>

          {filtered.length > 0 && sessions.length > 0 && (
            <p className="text-[10px] text-gray-400 px-0.5 mb-2 shrink-0">
              {filtered.length < sessions.length ? `${filtered.length} / ${sessions.length} 个岗位` : `${sessions.length} 个岗位`}
            </p>
          )}

          {/* List — only this scrolls */}
          <div className="flex-1 overflow-y-auto min-h-0 px-0.5 py-0.5 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                <span className="w-4 h-4 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-xs">加载中...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                {sessions.length === 0 ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mb-4">💼</div>
                    <p className="text-sm font-semibold text-gray-600 mb-1">还没有职位</p>
                    <p className="text-xs text-gray-400 mb-5 leading-relaxed">粘贴 JD 或上传截图<br/>AI 自动解析关键信息</p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                    >＋ 添加第一个 JD</button>
                  </>
                ) : (
                  <>
                    <div className="text-3xl mb-3 opacity-30">🔍</div>
                    <p className="text-sm text-gray-500 font-medium">无匹配结果</p>
                    <button onClick={() => setSearchText('')} className="mt-2 text-xs text-indigo-500 hover:underline">清除搜索</button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((s) => (
                <JDListItem
                  key={s.id}
                  session={s}
                  selected={s.id === selectedId}
                  onClick={() => setSelectedId(s.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedSession ? (
            <JDDetailPanel
              key={selectedSession.id}
              session={selectedSession}
            />
          ) : !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl opacity-40">💼</div>
              <p className="text-sm text-gray-400">从左侧选择一个岗位查看详情</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddJDModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
