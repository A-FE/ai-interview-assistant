export interface User {
  user_id: number
  username: string
  is_guest: boolean
  access_token: string
}

export interface JDSummary {
  title: string | null
  company: string | null
  core_stack: string[]
  level: string | null
  salary: string | null
  city: string | null
  education: string | null
  match_score: number | null
}

export interface JDSession {
  id: number
  jd_text: string
  analysis_result: string | null
  jd_summary: string | null  // JSON string of JDSummary
  title: string | null
  company: string | null
  created_at: string
}

export interface InterviewSession {
  id: number
  jd_session_id: number
  status: 'active' | 'ended'
  created_at: string
}

export interface InterviewReport {
  id: number
  jd_session_id: number
  overall_score: number | null
  report_json: string
  weak_points_summary: string | null
  created_at: string
}

export interface WorkExperience {
  company: string
  title: string
  duration: string
  highlights: string[]
}

export interface ResumeProject {
  name: string
  role: string
  tech_stack: string[]
  description: string
}

export interface ResumeSummary {
  name: string | null
  years_exp: string | null
  current_title: string | null
  core_skills: string[]
  education: string | null
  summary_text: string | null
  work_experience: WorkExperience[]
  projects: ResumeProject[]
  certifications: string[]
}

export interface Resume {
  id: number
  filename: string
  summary: string | null  // JSON string of ResumeSummary
  status: 'parsing' | 'done' | 'failed'
  created_at: string
}

// ─── Study Plan ──────────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'mastered' | 'needs_review' | 'skipped'
export type StepCategory = '知识点' | '算法题型' | '项目方向'
export type StepPriority = '高' | '中' | '低'

export interface StudyStep {
  index: number
  category: StepCategory
  title: string
  priority: StepPriority
  difficulty: number    // 1-5
  is_weakness: boolean
  why_important: string
  key_points: string[]
  resources: string[]
}

export interface StudyPlan {
  meta: {
    estimated_hours: string
    total_steps: number
  }
  steps: StudyStep[]
}

export interface StudyStepProgressRecord {
  step_index: number
  status: StepStatus
  updated_at: string
}
