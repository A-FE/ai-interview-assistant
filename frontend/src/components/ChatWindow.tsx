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
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
              {msg.isStreaming && (
                <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <textarea
          className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <button
          type="submit"
          disabled={disabled || isStreaming || !input.trim()}
          className="self-end px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {isStreaming ? '...' : '发送'}
        </button>
      </form>
    </div>
  )
}
