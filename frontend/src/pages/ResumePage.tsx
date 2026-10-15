import { useState, useEffect, useRef } from 'react'
import { resumeAPI } from '../api'
import type { Resume, ResumeSummary } from '../types'

function parseSummary(raw: string | null): ResumeSummary | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ResumeSummary
  } catch {
    return null
  }
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadResumes()
  }, [])

  const loadResumes = () => {
    setLoading(true)
    setLoadError('')
    resumeAPI.list()
      .then((res) => setResumes(res.data))
      .catch(() => setLoadError('加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  const handleUpload = async (file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.doc')) {
      setUploadError('仅支持 PDF 或 Word 文件（.pdf / .docx）')
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      const res = await resumeAPI.upload(file)
      setResumes((prev) => [res.data, ...prev])
    } catch (e: any) {
      setUploadError(e?.response?.data?.detail || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除这份简历？')) return
    try {
      await resumeAPI.delete(id)
      setResumes((prev) => prev.filter((r) => r.id !== id))
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">简历管理</h1>
        <p className="text-sm text-gray-400 mt-1">上传 PDF 或 Word 格式的简历，自动提取关键信息</p>
      </div>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 mb-6 ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-indigo-600 font-medium">正在解析简历...</p>
            <p className="text-xs text-gray-400">AI 正在提取关键信息，请稍候</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-2xl shadow-sm">
              📄
            </div>
            <p className="text-sm font-medium text-gray-700">拖拽文件到此处，或点击上传</p>
            <p className="text-xs text-gray-400">支持 PDF、Word（.docx / .doc），最大 10 MB</p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span> {uploadError}
        </div>
      )}

      {/* Resume list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
          <span className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-sm text-red-500 mb-3">{loadError}</p>
          <button
            onClick={loadResumes}
            className="text-sm text-indigo-600 hover:underline"
          >
            重新加载
          </button>
        </div>
      ) : resumes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl opacity-20 mb-3">📂</div>
          <p className="text-sm">还没有上传简历，立即上传开始使用</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resumes.map((resume) => {
            const summary = parseSummary(resume.summary)
            return (
              <div
                key={resume.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* File icon */}
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">
                      {resume.filename.toLowerCase().endsWith('.pdf') ? '📕' : '📘'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{resume.filename}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(resume.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(resume.id)}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-all shrink-0"
                  >
                    删除
                  </button>
                </div>

                {/* LLM-extracted summary */}
                {summary ? (
                  <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {summary.name && (
                        <span className="text-sm font-bold text-gray-900">{summary.name}</span>
                      )}
                      {summary.years_exp && (
                        <span className="text-xs text-gray-500">🕐 {summary.years_exp}经验</span>
                      )}
                      {summary.education && (
                        <span className="text-xs text-gray-500">🎓 {summary.education}</span>
                      )}
                    </div>
                    {summary.summary_text && (
                      <p className="text-sm text-gray-600 leading-relaxed">{summary.summary_text}</p>
                    )}
                    {summary.core_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {summary.core_skills.map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 italic">摘要提取中...</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
