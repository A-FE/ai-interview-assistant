import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ragAPI } from '../api'

interface DocSummary {
  source: string
  chunk_count: number
}

interface Chunk {
  id: string
  text: string
  index: number
  extra_meta: Record<string, unknown> | null
}

function ChunkItem({ chunk }: { chunk: Chunk }) {
  const [expanded, setExpanded] = useState(false)
  const byteSize = new TextEncoder().encode(chunk.text).length
  const sizeLabel = byteSize >= 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden hover:border-indigo-100 transition-colors">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-indigo-400">#{chunk.index}</span>
          <span className="text-xs text-gray-400">{chunk.text.length} 字 · {sizeLabel}</span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-2 py-0.5 rounded-md text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          {expanded ? '收起 ▲' : '展开 ▼'}
        </button>
      </div>

      {/* Content */}
      <div className={`px-4 py-3 markdown-body ${!expanded ? 'line-clamp-3 overflow-hidden' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {chunk.text}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function DocPanel({ source, onClose }: { source: string; onClose: () => void }) {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    ragAPI.getChunks(source)
      .then((res) => setChunks(res.data))
      .catch(() => setError('加载文档块失败'))
      .finally(() => setLoading(false))
  }, [source])

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{source}</h2>
          {!loading && !error && (
            <p className="text-xs text-gray-400 mt-0.5">{chunks.length} 个文档块</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xl"
        >
          ×
        </button>
      </div>

      {/* Chunks */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <span className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400 text-sm">{error}</div>
        ) : chunks.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">该文档暂无内容块</div>
        ) : (
          chunks.map((chunk) => <ChunkItem key={chunk.id} chunk={chunk} />)
        )}
      </div>
    </div>
  )
}

export default function KBPage() {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    ragAPI.listDocs()
      .then((res) => setDocs(res.data))
      .catch(() => setError('加载知识库失败，请确认后端已启动且知识库已初始化'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">知识库文档</h1>
        <p className="text-sm text-gray-400 mt-1">向量库中存储的所有文档，点击查看文档块内容</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: doc list */}
        <div className="w-72 shrink-0">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                <span className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="p-6 text-center text-sm text-red-400">{error}</div>
            ) : docs.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-3xl mb-3 opacity-20">📚</div>
                <p className="text-sm text-gray-400">知识库为空</p>
                <p className="text-xs text-gray-300 mt-1">请运行 python -m backend.rag.init_kb</p>
              </div>
            ) : (
              <ul>
                {docs.map((doc, i) => (
                  <li key={doc.source}>
                    <button
                      onClick={() => setSelected(doc.source === selected ? null : doc.source)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${
                        i > 0 ? 'border-t border-gray-50' : ''
                      } ${
                        selected === doc.source
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">📄</span>
                        <span className="text-sm font-medium truncate">{doc.source}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-md shrink-0 ${
                        selected === doc.source
                          ? 'bg-indigo-100 text-indigo-500'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {doc.chunk_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!loading && !error && docs.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 px-1">
              共 {docs.length} 个文档，
              {docs.reduce((s, d) => s + d.chunk_count, 0)} 个文本块
            </p>
          )}
        </div>

        {/* Right: chunk detail */}
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm" style={{ minHeight: 480 }}>
              <DocPanel source={selected} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-gray-400" style={{ minHeight: 480 }}>
              <div className="text-center">
                <div className="text-4xl mb-3 opacity-20">👈</div>
                <p className="text-sm">点击左侧文档查看内容块</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
