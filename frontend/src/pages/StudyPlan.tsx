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
  const [pastReports, setPastReports] = useState<InterviewReport[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    if (jdSessionId) {
      reportAPI.byJD(jdSessionId).then((res) => setPastReports(res.data)).catch(() => {})
    }
  }, [jdSessionId])

  const handleGenerate = async () => {
    if (!jdSessionId) return
    setLoading(true)
    setPlan('')
    try {
      await postSSE(
        studyAPI.planUrl(),
        { jd_session_id: jdSessionId },
        (chunk) => setPlan((prev) => prev + chunk),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">个性化复习清单</h1>
        {pastReports.length > 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 text-xs rounded-full border border-orange-200">
            ⚠️ 已检测到 {pastReports.length} 份历史报告，将启用薄弱点优先模式
          </span>
        )}
      </div>

      {!plan && (
        <div className="bg-blue-50 rounded-2xl p-6 mb-6 text-sm text-gray-600">
          <p className="mb-2 font-medium">本次复习清单将包含：</p>
          <ul className="space-y-1 list-disc list-inside text-gray-500">
            <li>优先复习知识点（按面试权重排序）</li>
            <li>推荐算法题型</li>
            <li>项目深挖方向</li>
            {pastReports.length > 0 && <li className="text-orange-600">✅ 已掌握知识点 / ⚠️ 历史薄弱知识点（基于历史面试报告）</li>}
          </ul>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !jdSessionId}
        className="mb-6 px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
      >
        {loading ? '🤖 生成中...' : plan ? '重新生成' : '生成复习清单'}
      </button>

      {plan && (
        <div className="bg-white rounded-2xl border p-6">
          <MarkdownRenderer content={plan} />
          {!loading && (
            <div className="mt-6 pt-4 border-t flex gap-3">
              <button
                onClick={() => navigate(`/interview?jd=${jdSessionId}`)}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                🎯 开始模拟面试
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(plan)}
                className="px-5 py-2.5 border text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                复制清单
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
