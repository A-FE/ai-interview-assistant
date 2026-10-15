import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportAPI } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { InterviewReport } from '../types'

export default function Report() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    reportAPI.get(Number(id))
      .then((res) => setReport(res.data))
      .catch(() => navigate('/user'))
      .finally(() => setLoading(false))
  }, [id])

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
  const scoreBg = score == null ? '' : score >= 80 ? 'bg-emerald-50 border-emerald-100' : score >= 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
  const scoreLabel = score == null ? '' : score >= 80 ? '优秀' : score >= 60 ? '良好' : '待提升'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">面试评估报告</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(report.created_at).toLocaleString('zh-CN')}
          </p>
        </div>
        {score != null && (
          <div className={`flex flex-col items-center px-5 py-3 rounded-2xl border ${scoreBg}`}>
            <span className={`text-3xl font-extrabold ${scoreColor}`}>{score}</span>
            <span className={`text-xs font-medium mt-0.5 ${scoreColor}`}>{scoreLabel}</span>
          </div>
        )}
      </div>

      {/* Weak points banner */}
      {report.weak_points_summary && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-700 mb-1">薄弱知识点（下次面试将重点考察）</p>
            <p className="text-sm text-amber-600 leading-relaxed">{report.weak_points_summary}</p>
          </div>
        </div>
      )}

      {/* Report content */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-6">
        <MarkdownRenderer content={report.report_json} />
      </div>

      {/* Actions */}
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
