import { useState, useEffect, useRef } from 'react'
import { resumeAPI } from '../api'
import type { Resume, ResumeSummary, WorkExperience, ResumeProject } from '../types'

function parseSummary(raw: string | null): ResumeSummary | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ResumeSummary
  } catch {
    return null
  }
}

async function triggerDownload(resume: Resume) {
  try {
    const res = await resumeAPI.download(resume.id)
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = resume.filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert('下载失败，该简历可能在下载功能上线前上传，请重新上传')
  }
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function WorkExpItem({ item }: { item: WorkExperience }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-gray-900">{item.title}</span>
          <span className="text-sm text-gray-500 ml-2">· {item.company}</span>
        </div>
        {item.duration && (
          <span className="text-xs text-gray-400 shrink-0">{item.duration}</span>
        )}
      </div>
      {item.highlights?.length > 0 && (
        <ul className="space-y-1 pl-3">
          {item.highlights.map((h, i) => (
            <li key={i} className="text-xs text-gray-600 leading-relaxed flex gap-1.5">
              <span className="text-indigo-300 shrink-0 mt-0.5">•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ProjectItem({ item }: { item: ResumeProject }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
        {item.role && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">{item.role}</span>
        )}
      </div>
      {item.description && (
        <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
      )}
      {item.tech_stack?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tech_stack.map((t, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-medium">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function ResumeDetail({ resume, onClose }: { resume: Resume; onClose: () => void }) {
  const summary = parseSummary(resume.summary)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setDownloading(true)
    await triggerDownload(resume)
    setDownloading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">
              {resume.filename.toLowerCase().endsWith('.pdf') ? '📕' : '📘'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[240px]">{resume.filename}</p>
              <p className="text-xs text-gray-400">{new Date(resume.created_at).toLocaleString('zh-CN')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {downloading ? (
                <span className="w-3 h-3 border border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <span>⬇</span>
              )}
              下载原件
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {summary ? (
            <>
              {/* Basic info */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  {summary.name && (
                    <h2 className="text-xl font-bold text-gray-900">{summary.name}</h2>
                  )}
                  {summary.current_title && (
                    <span className="text-sm text-indigo-600 font-medium">{summary.current_title}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {summary.years_exp && (
                    <span className="text-sm text-gray-500">🕐 {summary.years_exp} 工作经验</span>
                  )}
                  {summary.education && (
                    <span className="text-sm text-gray-500">🎓 {summary.education}</span>
                  )}
                </div>
              </div>

              {/* Summary text */}
              {summary.summary_text && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">个人简介</p>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
                    {summary.summary_text}
                  </p>
                </div>
              )}

              {/* Core skills */}
              {summary.core_skills?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">核心技能</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.core_skills.map((skill, i) => (
                      <span key={i} className="text-sm px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Work experience */}
              {summary.work_experience?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">工作经历</p>
                  <div className="space-y-4">
                    {summary.work_experience.map((exp, i) => (
                      <WorkExpItem key={i} item={exp} />
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {summary.projects?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">项目经历</p>
                  <div className="space-y-4">
                    {summary.projects.map((proj, i) => (
                      <ProjectItem key={i} item={proj} />
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {summary.certifications?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">证书 & 资质</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.certifications.map((cert, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg font-medium border border-amber-100">
                        🏅 {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm">AI 正在解析简历，请稍后查看</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResumePage() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [selected, setSelected] = useState<Resume | null>(null)
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

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    if (!confirm('确认删除这份简历？')) return
    try {
      await resumeAPI.delete(id)
      setResumes((prev) => prev.filter((r) => r.id !== id))
      if (selected?.id === id) setSelected(null)
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
          <button onClick={loadResumes} className="text-sm text-indigo-600 hover:underline">
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
                onClick={() => setSelected(resume)}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">
                      {resume.filename.toLowerCase().endsWith('.pdf') ? '📕' : '📘'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                        {resume.filename}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(resume.created_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      查看详情 →
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, resume.id)}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-all"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* Summary preview */}
                {summary ? (
                  <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {summary.name && (
                        <span className="text-sm font-bold text-gray-900">{summary.name}</span>
                      )}
                      {summary.current_title && (
                        <span className="text-xs text-indigo-500 font-medium">{summary.current_title}</span>
                      )}
                      {summary.years_exp && (
                        <span className="text-xs text-gray-500">🕐 {summary.years_exp}经验</span>
                      )}
                      {summary.education && (
                        <span className="text-xs text-gray-500">🎓 {summary.education}</span>
                      )}
                    </div>
                    {summary.summary_text && (
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{summary.summary_text}</p>
                    )}
                    {summary.core_skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {summary.core_skills.slice(0, 6).map((skill, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-medium">
                            {skill}
                          </span>
                        ))}
                        {summary.core_skills.length > 6 && (
                          <span className="text-xs px-2 py-0.5 text-gray-400">+{summary.core_skills.length - 6}</span>
                        )}
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

      {/* Detail modal */}
      {selected && (
        <ResumeDetail resume={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
