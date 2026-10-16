import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportAPI, jdAPI } from '../api'
import type { InterviewReport, JDSession, JDSummary } from '../types'

function parseSummary(raw: string | null): JDSummary | null {
  if (!raw) return null
  try { return JSON.parse(raw) as JDSummary } catch { return null }
}

export default function Records() {
  const [reports, setReports] = useState<InterviewReport[]>([])
  const [sessions, setSessions] = useState<Record<number, JDSession>>({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      reportAPI.list().then((res) => setReports(res.data)),
      jdAPI.listSessions().then((res) => {
        const map: Record<number, JDSession> = {}
        for (const s of res.data) map[s.id] = s
        setSessions(map)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
        <span className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">加载中...</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">面试记录</h1>
          <p className="text-sm text-gray-400 mt-1">历次模拟面试报告</p>
        </div>
        <button
          onClick={() => navigate('/jd')}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all duration-200 shadow-sm"
        >
          💼 职位分析
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-5xl mb-4 opacity-20">📋</div>
          <p className="text-gray-500 font-medium mb-2">还没有面试记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const jd = sessions[report.jd_session_id]
            const summary = parseSummary(jd?.jd_summary ?? null)
            const jobTitle = jd?.title || summary?.title || `JD #${report.jd_session_id}`
            const company = jd?.company || summary?.company
            const score = report.overall_score
            const scoreColor = score == null ? '' : score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-red-500'
            const scoreBg   = score == null ? '' : score >= 80 ? 'bg-emerald-50' : score >= 60 ? 'bg-amber-50' : 'bg-red-50'

            return (
              <div
                key={report.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 truncate mb-0.5">{jobTitle}</h3>
                    {company && <p className="text-sm text-gray-500 mb-1">{company}</p>}
                    <p className="text-xs text-gray-400">
                      {new Date(report.created_at).toLocaleString('zh-CN')}
                    </p>
                    {report.weak_points_summary && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{report.weak_points_summary}</p>
                    )}
                  </div>
                  {score != null && (
                    <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl shrink-0 ${scoreBg}`}>
                      <span className={`text-lg font-extrabold leading-none ${scoreColor}`}>{score}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">分</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/report/${report.id}`)}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg hover:bg-indigo-100 active:scale-95 transition-all"
                  >
                    📊 查看报告
                  </button>
                  <button
                    onClick={() => navigate(`/interview?jd=${report.jd_session_id}`)}
                    className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 rounded-lg hover:bg-orange-100 active:scale-95 transition-all"
                  >
                    🎯 再次面试
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
