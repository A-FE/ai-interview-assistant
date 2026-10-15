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

  if (loading) return <div className="flex justify-center py-20 text-gray-400">加载中...</div>
  if (!report) return null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">面试评估报告</h1>
        {report.overall_score != null && (
          <span className={`text-3xl font-bold ${report.overall_score >= 80 ? 'text-green-600' : report.overall_score >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
            {report.overall_score} 分
          </span>
        )}
      </div>

      {report.weak_points_summary && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <p className="text-sm font-medium text-orange-700 mb-1">⚠️ 薄弱知识点（下次面试将重点考察）</p>
          <p className="text-sm text-orange-600">{report.weak_points_summary}</p>
        </div>
      )}

      <div className="bg-white border rounded-2xl p-6">
        <MarkdownRenderer content={report.report_json} />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/study?jd=${report.jd_session_id}`)}
          className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
        >
          📚 生成针对性复习清单
        </button>
        <button
          onClick={() => navigate(`/interview?jd=${report.jd_session_id}`)}
          className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          🎯 二次模拟面试（薄弱点优先）
        </button>
        <button
          onClick={() => navigate('/user')}
          className="px-5 py-2.5 border text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          用户中心
        </button>
      </div>
    </div>
  )
}
