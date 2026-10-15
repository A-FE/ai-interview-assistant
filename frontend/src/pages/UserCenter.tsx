import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jdAPI, reportAPI } from '../api'
import type { JDSession, InterviewReport } from '../types'

export default function UserCenter() {
  const [sessions, setSessions] = useState<JDSession[]>([])
  const [reports, setReports] = useState<InterviewReport[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      jdAPI.listSessions().then((res) => setSessions(res.data)),
      reportAPI.list().then((res) => setReports(res.data)),
    ]).finally(() => setLoading(false))
  }, [])

  const reportsForJD = (jdId: number) => reports.filter((r) => r.jd_session_id === jdId)

  if (loading) return <div className="flex justify-center py-20 text-gray-400">加载中...</div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">用户中心</h1>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-4">还没有 JD 分析记录</p>
          <button
            onClick={() => navigate('/jd')}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            开始分析第一个 JD
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const jdReports = reportsForJD(session.id)
            const latestReport = jdReports[0]
            const jdPreview = session.jd_text.slice(0, 80).replace(/\n/g, ' ')

            return (
              <div key={session.id} className="bg-white border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 mb-1">
                      {new Date(session.created_at).toLocaleString('zh-CN')}
                    </p>
                    <p className="text-sm text-gray-700 truncate">{jdPreview}...</p>
                  </div>
                  {latestReport?.overall_score != null && (
                    <span className={`text-xl font-bold shrink-0 ${latestReport.overall_score >= 80 ? 'text-green-600' : latestReport.overall_score >= 60 ? 'text-orange-500' : 'text-red-500'}`}>
                      {latestReport.overall_score}分
                    </span>
                  )}
                </div>

                {jdReports.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">历史面试报告（{jdReports.length} 份）</p>
                    <div className="flex flex-wrap gap-2">
                      {jdReports.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => navigate(`/report/${r.id}`)}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors"
                        >
                          {new Date(r.created_at).toLocaleDateString('zh-CN')}
                          {r.overall_score != null && ` · ${r.overall_score}分`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/study?jd=${session.id}`)}
                    className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    📚 复习清单
                  </button>
                  <button
                    onClick={() => navigate(`/interview?jd=${session.id}`)}
                    className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    🎯 {jdReports.length > 0 ? '再次面试（薄弱点模式）' : '开始面试'}
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
