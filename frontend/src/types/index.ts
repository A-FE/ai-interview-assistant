export interface User {
  user_id: number
  username: string
  is_guest: boolean
  access_token: string
}

export interface JDSession {
  id: number
  jd_text: string
  analysis_result: string | null
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
