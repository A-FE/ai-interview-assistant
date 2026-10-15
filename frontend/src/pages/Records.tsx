import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jdAPI, reportAPI } from '../api'
import type { JDSession, InterviewReport, JDSummary } from '../types'

function parseSummary(raw: string | null): JDSummary | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as JDSummary
  } catch {
    return null
  }
}

export default function Records() {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">分析记录</h1>
          <p className="text-sm text-gray-400 mt-1">我的 JD 分析记录与面试历史</p>
        </div>
        {sessions.length > 0 && (
          <button
            onClick={() => navigate('/jd')}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all duration-200 shadow-sm"
          >
            + 新建 JD 分析
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-5xl mb-4 opacity-20">📋</div>
          <p className="text-gray-500 font-medium mb-2">还没有 JD 分析记录</p>
          <p className="text-sm text-gray-400 mb-6">分析第一个岗位 JD，开启备考之旅</p>
          <button
            onClick={() => navigate('/jd')}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all duration-200 shadow-sm"
          >
            开始分析第一个 JD
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const jdReports = reportsForJD(session.id)
            const latestReport = jdReports[0]
            const summary = parseSummary(session.jd_summary)
            const score = latestReport?.overall_score
            const scoreColor = score == null ? '' : score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-500' : 'text-red-500'
            const scoreBg = score == null ? '' : score >= 80 ? 'bg-emerald-50' : score >= 60 ? 'bg-amber-50' : 'bg-red-50'

            return (
              <div
                key={session.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Summary fields */}
                    {summary ? (
                      <>
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            {summary.title || '未识别岗位'}
                          </h3>
                          {summary.level && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full shrink-0">
                              {summary.level}
                            </span>
                          )}
                        </div>
                        {summary.company && (
                          <p className="text-sm text-gray-500 mb-2">{summary.company}</p>
                        )}
                        {summary.core_stack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {summary.core_stack.slice(0, 6).map((tech, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium"
                              >
                                {tech}
                              </span>
                            ))}
                            {summary.core_stack.length > 6 && (
                              <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-400 rounded-md">
                                +{summary.core_stack.length - 6}
                              </span>
                            )}
                          </div>
                        )}
                        {summary.match_score != null && (
                          <p className="text-xs text-gray-400 mb-1">
                            匹配度：<span className="font-semibold text-indigo-500">{summary.match_score}分</span>
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-700 truncate mb-1">
                        {session.jd_text.slice(0, 80).replace(/\n/g, ' ')}...
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(session.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {score != null && (
                    <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl shrink-0 ${scoreBg}`}>
                      <span className={`text-lg font-extrabold leading-none ${scoreColor}`}>{score}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">分</span>
                    </div>
                  )}
                </div>

                {jdReports.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-2">历史面试报告（{jdReports.length} 份）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {jdReports.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => navigate(`/report/${r.id}`)}
                          className="text-xs px-3 py-1 bg-gray-50 border border-gray-100 text-gray-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all duration-200"
                        >
                          {new Date(r.created_at).toLocaleDateString('zh-CN')}
                          {r.overall_score != null && (
                            <span className="ml-1 font-semibold">{r.overall_score}分</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => navigate(`/study?jd=${session.id}`)}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 active:scale-95 transition-all duration-200"
                  >
                    📚 复习清单
                  </button>
                  <button
                    onClick={() => navigate(`/interview?jd=${session.id}`)}
                    className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 rounded-lg hover:bg-orange-100 active:scale-95 transition-all duration-200"
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
