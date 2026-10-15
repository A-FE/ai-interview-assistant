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
      // Load opening question via SSE
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
    // Append user message
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
        // Check if interviewer wants code editor
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
    <div className="max-w-6xl mx-auto px-4 py-4 h-[calc(100vh-56px)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">模拟面试</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCodeEditor((v) => !v)}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showCodeEditor ? '收起代码编辑器' : '展开代码编辑器'}
          </button>
          <button
            onClick={handleEnd}
            disabled={!session || ending || isStreaming}
            className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
          >
            结束面试
          </button>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden grid gap-4 ${showCodeEditor ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Chat */}
        <div className="bg-white rounded-2xl border flex flex-col overflow-hidden">
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            onSend={handleSend}
            disabled={!session || ending}
          />
        </div>

        {/* Code Editor */}
        {showCodeEditor && (
          <div className="bg-white rounded-2xl border flex flex-col overflow-hidden">
            <div className="border-b px-4 py-2 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">代码编辑器</span>
              <select
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value as 'python' | 'javascript')}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
              <span className="text-xs text-gray-400 ml-auto">提交后由沙箱自动运行</span>
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
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
