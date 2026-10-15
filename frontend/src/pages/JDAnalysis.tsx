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

  const textareaClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 resize-none placeholder:text-gray-400"

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">JD 智能解析</h1>
        <p className="text-sm text-gray-400 mt-1">粘贴目标岗位 JD，AI 自动提取技术要求并评估匹配度</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: input */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                目标岗位 JD
                <span className="text-red-400 font-normal normal-case">必填</span>
              </label>
              <textarea
                className={textareaClass}
                style={{ height: '180px' }}
                placeholder="粘贴职位描述（JD）到此处..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                个人简历 <span className="normal-case font-normal text-gray-400">可选，用于匹配度分析</span>
              </label>
              <textarea
                className={textareaClass}
                style={{ height: '130px' }}
                placeholder="粘贴你的简历文本..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !jdText.trim()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 shadow-sm shadow-indigo-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  AI 分析中...
                </>
              ) : '🔍 开始解析'}
            </button>
          </div>
        </div>

        {/* Right: result */}
        <div className={`rounded-2xl border transition-all duration-300 ${result ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-100 border-dashed'} p-5 min-h-64`}>
          {result ? (
            <>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-xs font-medium text-gray-500">分析结果</span>
                {loading && <span className="text-xs text-indigo-500 ml-auto animate-pulse">生成中...</span>}
              </div>
              <MarkdownRenderer content={result} />
              {!loading && sessionId && (
                <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate(`/study?jd=${sessionId}`)}
                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    📚 生成复习清单
                  </button>
                  <button
                    onClick={() => navigate(`/interview?jd=${sessionId}`)}
                    className="py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5"
                  >
                    🎯 模拟面试
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 py-12">
              <div className="text-4xl opacity-30">🤖</div>
              <p className="text-sm">{loading ? '正在分析，请稍候...' : '分析结果将显示在这里'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
