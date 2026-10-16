import { useState, useRef, useEffect } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface Props {
  messages: Message[]
  isStreaming: boolean
  onSend: (content: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ChatWindow({ messages, isStreaming, onSend, placeholder = '输入你的回答...', disabled = false }: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || disabled || isStreaming) return
    onSend(text)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                AI
              </div>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-900 rounded-tl-sm border border-gray-100'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
              )}
              {msg.isStreaming && (
                <span className="inline-flex gap-0.5 ml-1">
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0 mt-0.5">
                我
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-white p-3">
        <div className="relative">
          <textarea
            className="w-full resize-none border border-gray-200 rounded-xl px-3 py-2.5 pr-20 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
          />
          <span className="absolute right-3 bottom-2.5 text-xs text-gray-300 select-none pointer-events-none">
            {isStreaming ? (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            ) : '↵ 发送'}
          </span>
        </div>
      </form>
    </div>
  )
}
