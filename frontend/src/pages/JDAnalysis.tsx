import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jdAPI, postSSE } from '../api'
import { MarkdownRenderer } from '../components/MarkdownRenderer'

export default function JDAnalysis() {
  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [result, setResult] = useState('')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleAnalyze = async () => {
    if (!jdText.trim()) return
    setLoading(true)
    setResult('')
    setSessionId(null)

    try {
      await postSSE(
        jdAPI.analyzeUrl(),
        { jd_text: jdText, resume_text: resumeText || undefined },
        (chunk) => setResult((prev) => prev + chunk),
        (extra) => {
          if (extra?.session_id) setSessionId(extra.session_id as number)
        },
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">JD 智能解析</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标岗位 JD <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full h-48 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="粘贴职位描述（JD）到此处..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              个人简历（可选，用于匹配度分析）
            </label>
            <textarea
              className="w-full h-36 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="粘贴你的简历文本..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !jdText.trim()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {loading ? '🤖 AI 分析中...' : '开始解析'}
          </button>
        </div>

        {/* Right: result */}
        <div className="bg-gray-50 rounded-2xl p-5 min-h-64">
          {result ? (
            <>
              <MarkdownRenderer content={result} />
              {!loading && sessionId && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => navigate(`/study?jd=${sessionId}`)}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    📚 生成复习清单
                  </button>
                  <button
                    onClick={() => navigate(`/interview?jd=${sessionId}`)}
                    className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    🎯 开始模拟面试
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              {loading ? '正在分析，请稍候...' : '分析结果将显示在这里'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
