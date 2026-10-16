import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jdAPI } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { JDSession, JDSummary } from '../types'

function parseSummary(raw: string | null): JDSummary | null {
  if (!raw) return null
  try { return JSON.parse(raw) as JDSummary } catch { return null }
}

export default function JDDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<JDSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    jdAPI.getSession(Number(id))
      .then((res) => setSession(res.data))
      .catch(() => setError('JD 不存在或无权访问'))
      .finally(() => setLoading(false))
  }, [id])

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
      <button onClick={() => navigate('/jd')} className="mt-4 text-sm text-indigo-600 hover:underline">
        ← 返回职位分析
      </button>
    </div>
  )

  const summary = parseSummary(session.jd_summary)
  const title = session.title || summary?.title || '未识别岗位'
  const company = session.company || summary?.company

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/jd')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-all"
      >
        ← 职位列表
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {summary?.level && (
            <span className="text-sm px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">{summary.level}</span>
          )}
          {summary?.match_score != null && (
            <span className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${
              summary.match_score >= 80 ? 'bg-emerald-50 text-emerald-600' :
              summary.match_score >= 60 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
            }`}>
              匹配度 {summary.match_score}分
            </span>
          )}
        </div>
        {company && <p className="text-gray-500 mb-2">{company}</p>}
        {summary && summary.core_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {summary.core_stack.map((tech, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium">
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* JD original text */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">原始 JD</h2>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{session.jd_text}</pre>
        </div>

        {/* Analysis result */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">AI 分析</h2>
          {session.analysis_result ? (
            <MarkdownRenderer content={session.analysis_result} />
          ) : (
            <p className="text-sm text-gray-400">暂无分析结果</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={() => navigate(`/study?jd=${session.id}`)}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
        >📚 生成复习清单</button>
        <button
          onClick={() => navigate(`/interview?jd=${session.id}`)}
          className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all shadow-sm"
        >🎯 模拟面试</button>
      </div>
    </div>
  )
}
