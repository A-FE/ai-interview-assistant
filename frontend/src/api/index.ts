import axios from 'axios'

const API_BASE = 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: (username: string, password: string, email?: string) =>
    api.post('/api/auth/register', { username, password, email }),
  login: (username: string, password: string) =>
    api.post('/api/auth/login', { username, password }),
  guest: () => api.post('/api/auth/guest'),
}

// ─── JD ──────────────────────────────────────────────────────────────────────

export const jdAPI = {
  listSessions: () => api.get('/api/jd/sessions'),
  getSession: (id: number) => api.get(`/api/jd/sessions/${id}`),
  deleteSession: (id: number) => api.delete(`/api/jd/sessions/${id}`),
  // Create session without AI analysis (title/company extracted only)
  createSession: (jd_text: string) => api.post('/api/jd/sessions/create', { jd_text }),
  // SSE URL for deep analysis (requires resume_id in POST body)
  analyzeSessionUrl: (session_id: number) => `${API_BASE}/api/jd/sessions/${session_id}/analyze`,
  /** @deprecated Use createSession + analyzeSessionUrl instead */
  analyzeUrl: () => `${API_BASE}/api/jd/analyze`,
  ocr: (image_base64: string, mime_type: string) =>
    api.post('/api/jd/ocr', { image_base64, mime_type }),
}

// ─── Study ───────────────────────────────────────────────────────────────────

export const studyAPI = {
  planUrl: () => `${API_BASE}/api/study/plan`,
  planBody: (jd_session_id: number, force_refresh = false) =>
    ({ jd_session_id, force_refresh }),
  getProgress: (jdSessionId: number) =>
    api.get(`/api/study/${jdSessionId}/progress`),
  updateProgress: (jdSessionId: number, stepIndex: number, status: string) =>
    api.put(`/api/study/${jdSessionId}/progress`, { step_index: stepIndex, status }),
  chatUrl: (jdSessionId: number, stepIndex: number) =>
    `${API_BASE}/api/study/${jdSessionId}/steps/${stepIndex}/chat`,
}

// ─── Interview ───────────────────────────────────────────────────────────────

export const interviewAPI = {
  start: (jd_session_id: number) =>
    api.post('/api/interview/start', { jd_session_id }),
  openingUrl: (id: number) => `${API_BASE}/api/interview/${id}/opening`,
  answerUrl: (id: number) => `${API_BASE}/api/interview/${id}/answer`,
  endUrl: (id: number) => `${API_BASE}/api/interview/${id}/end`,
}

// ─── Report ──────────────────────────────────────────────────────────────────

export const reportAPI = {
  list: () => api.get('/api/report/list'),
  get: (id: number) => api.get(`/api/report/${id}`),
  byJD: (jdSessionId: number) => api.get(`/api/report/by-jd/${jdSessionId}`),
}

// ─── Resume ──────────────────────────────────────────────────────────────────

export const resumeAPI = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    console.log('[resume] 开始上传:', file.name, `${(file.size / 1024).toFixed(1)} KB`, file.type)
    const t0 = performance.now()
    return api.post('/api/resume/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 120s — LLM 摘要提取可能耗时较长
      onUploadProgress: (e) => {
        if (e.total) {
          const pct = Math.round((e.loaded / e.total) * 100)
          console.log(`[resume] 上传进度: ${pct}% (${e.loaded}/${e.total} bytes)`)
        }
      },
    }).then((res) => {
      console.log(`[resume] 上传成功，总耗时 ${((performance.now() - t0) / 1000).toFixed(2)}s`, res.data)
      return res
    }).catch((err) => {
      const elapsed = ((performance.now() - t0) / 1000).toFixed(2)
      console.error(`[resume] 上传失败，耗时 ${elapsed}s`, {
        code: err.code,
        message: err.message,
        status: err.response?.status,
        detail: err.response?.data?.detail,
      })
      throw err
    })
  },
  list: () => api.get('/api/resume/list'),
  delete: (id: number) => api.delete(`/api/resume/${id}`),
  download: (id: number) => api.get(`/api/resume/${id}/download`, { responseType: 'blob' }),
}

// ─── RAG Knowledge Base ──────────────────────────────────────────────────────

export const ragAPI = {
  listDocs: () => api.get('/api/rag/docs'),
  getChunks: (source: string) => api.get(`/api/rag/docs/${encodeURIComponent(source)}/chunks`),
}

/** POST-based SSE: fetch with ReadableStream since EventSource only supports GET */
export async function postSSE(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  onDone?: (extra?: Record<string, unknown>) => void,
): Promise<void> {
  const token = localStorage.getItem('access_token')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const payload = JSON.parse(line.slice(6))
        if (payload.type === 'chunk') onChunk(payload.content)
        if (payload.type === 'done') onDone?.(payload)
      } catch {
        // skip malformed lines
      }
    }
  }
}
