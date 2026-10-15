import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { studyAPI, reportAPI, postSSE } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import type { InterviewReport } from '../types'

export default function StudyPlan() {
  const [searchParams] = useSearchParams()
  const jdSessionId = Number(searchParams.get('jd'))
  const [plan, setPlan] = useState('')
  const [loading, setLoading] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [pastReports, setPastReports] = useState<InterviewReport[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (jdSessionId) {
      reportAPI.byJD(jdSessionId).then((res) => setPastReports(res.data)).catch(() => {})
    }
  }, [jdSessionId])

  // Auto-load cached plan on first mount
  useEffect(() => {
    if (jdSessionId && !plan) {
      handleGenerate(false)
    }
  }, [jdSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async (forceRefresh = false) => {
    if (!jdSessionId) return
    setLoading(true)
    if (forceRefresh) setPlan('')
    setFromCache(false)

    try {
      await postSSE(
        studyAPI.planUrl(),
        studyAPI.planBody(jdSessionId, forceRefresh),
        (chunk) => setPlan((prev) => prev + chunk),
        (extra) => {
          setFromCache(extra?.cached === true)
        },
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">个性化复习清单</h1>
          <p className="text-sm text-gray-400 mt-1">基于 JD 要求生成精准复习计划</p>
        </div>
        {pastReports.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-xl border border-amber-200 shrink-0">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            检测到 {pastReports.length} 份历史报告，已启用薄弱点优先模式
          </span>
        )}
      </div>

      {/* Info card — only shown before first load */}
      {!plan && !loading && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-indigo-800 mb-2.5">📋 本次复习清单将包含</p>
          <ul className="space-y-1.5 text-sm text-indigo-600">
            <li className="flex items-center gap-2"><span className="w-1 h-1 bg-indigo-400 rounded-full" /> 优先复习知识点（按面试权重排序）</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 bg-indigo-400 rounded-full" /> 推荐算法题型</li>
            <li className="flex items-center gap-2"><span className="w-1 h-1 bg-indigo-400 rounded-full" /> 项目深挖方向</li>
            {pastReports.length > 0 && (
              <li className="flex items-center gap-2 text-amber-600">
                <span className="w-1 h-1 bg-amber-400 rounded-full" /> 已掌握 ✅ / 历史薄弱知识点 ⚠️（基于历史面试报告）
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !plan && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm text-indigo-600">正在加载复习清单...</span>
          </div>
          <div className="space-y-2.5 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="h-4 bg-gray-100 rounded w-5/6" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
          </div>
        </div>
      )}

      {/* Plan content */}
      {plan && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          {/* Status bar */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {loading ? (
                <>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                  <span className="text-xs text-indigo-600">生成中...</span>
                </>
              ) : fromCache ? (
                <>
                  <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="text-xs text-emerald-600">已缓存 · 上次生成的结果</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-blue-400 rounded-full" />
                  <span className="text-xs text-blue-600">最新生成</span>
                </>
              )}
            </div>
            {!loading && (
              <button
                onClick={() => handleGenerate(true)}
                className="text-xs text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
              >
                🔄 重新生成
              </button>
            )}
          </div>
          <MarkdownRenderer content={plan} />
          {!loading && (
            <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3 flex-wrap">
              <button
                onClick={() => navigate(`/interview?jd=${jdSessionId}`)}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200"
              >
                🎯 开始模拟面试
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(plan)}
                className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all duration-200"
              >
                📋 复制清单
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
