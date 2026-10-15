import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { interviewAPI, postSSE } from '../api'
import { ChatWindow, type Message } from '../components/ChatWindow'
import type { InterviewSession } from '../types'

export default function Interview() {
  const [searchParams] = useSearchParams()
  const jdSessionId = Number(searchParams.get('jd'))
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [showCodeEditor, setShowCodeEditor] = useState(false)
  const [code, setCode] = useState('')
  const [codeLanguage, setCodeLanguage] = useState<'python' | 'javascript'>('python')
  const [ending, setEnding] = useState(false)
  const navigate = useNavigate()

  // Start session on mount
  useEffect(() => {
    if (!jdSessionId) return
    interviewAPI.start(jdSessionId).then(async (res) => {
      const s: InterviewSession = res.data
      setSession(s)
      setIsStreaming(true)
      const openingMsg: Message = { role: 'assistant', content: '', isStreaming: true }
      setMessages([openingMsg])
      await postSSE(
        interviewAPI.openingUrl(s.id),
        {},
        (chunk) =>
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            }
            return updated
          }),
      )
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false }
        return updated
      })
      setIsStreaming(false)
    })
  }, [jdSessionId])

  const handleSend = async (content: string) => {
    if (!session) return
    setMessages((prev) => [...prev, { role: 'user', content }])
    setIsStreaming(true)
    const aiMsg: Message = { role: 'assistant', content: '', isStreaming: true }
    setMessages((prev) => [...prev, aiMsg])

    await postSSE(
      interviewAPI.answerUrl(session.id),
      { content, code: showCodeEditor ? code : undefined, language: codeLanguage },
      (chunk) =>
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + chunk }
          return updated
        }),
      (_extra) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last.content.includes('[CODE_QUESTION]')) {
            setShowCodeEditor(true)
          }
          return prev
        })
      },
    )
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false }
      return updated
    })
    setIsStreaming(false)
    setCode('')
  }

  const handleEnd = async () => {
    if (!session || ending) return
    setEnding(true)
    setIsStreaming(true)
    const evalMsg: Message = { role: 'assistant', content: '📊 正在生成面试评估报告...', isStreaming: true }
    setMessages((prev) => [...prev, evalMsg])
    let reportId: number | null = null

    await postSSE(
      interviewAPI.endUrl(session.id),
      {},
      (chunk) =>
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        }),
      (extra) => {
        if (extra?.report_id) reportId = extra.report_id as number
      },
    )
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = { ...updated[updated.length - 1], isStreaming: false }
      return updated
    })
    setIsStreaming(false)
    setEnding(false)
    if (reportId) navigate(`/report/${reportId}`)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 h-[calc(100vh-56px)] flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <h1 className="text-base font-bold text-gray-900">模拟面试</h1>
          {session && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Session #{session.id}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCodeEditor((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-all duration-200 ${
              showCodeEditor
                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                : 'text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {showCodeEditor ? '⌨️ 收起编辑器' : '⌨️ 代码编辑器'}
          </button>
          <button
            onClick={handleEnd}
            disabled={!session || ending || isStreaming}
            className="px-4 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 disabled:opacity-40 active:scale-95 transition-all duration-200"
          >
            {ending ? '生成报告中...' : '结束面试'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 overflow-hidden grid gap-3 ${showCodeEditor ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Chat */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            onSend={handleSend}
            disabled={!session || ending}
          />
        </div>

        {/* Code Editor */}
        {showCodeEditor && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-600">代码编辑器</span>
              <select
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value as 'python' | 'javascript')}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
              <span className="text-xs text-gray-400 ml-auto">Enter 提交 · 沙箱自动运行</span>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language={codeLanguage}
                value={code}
                onChange={(v) => setCode(v ?? '')}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
