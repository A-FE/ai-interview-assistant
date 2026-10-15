from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    is_guest: bool


# ─── JD ──────────────────────────────────────────────────────────────────────

class JDAnalyzeRequest(BaseModel):
    jd_text: str
    resume_text: Optional[str] = None


class JDSessionResponse(BaseModel):
    id: int
    jd_text: str
    analysis_result: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Study Plan ───────────────────────────────────────────────────────────────

class StudyPlanRequest(BaseModel):
    jd_session_id: int
    force_refresh: bool = False


# ─── Interview ───────────────────────────────────────────────────────────────

class InterviewStartRequest(BaseModel):
    jd_session_id: int


class InterviewAnswerRequest(BaseModel):
    content: str                    # user's text answer
    code: Optional[str] = None      # code submission if any
    language: Optional[str] = None  # python | javascript


class InterviewSessionResponse(BaseModel):
    id: int
    jd_session_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Report ──────────────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    id: int
    jd_session_id: int
    overall_score: Optional[float]
    report_json: str
    weak_points_summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Resume ──────────────────────────────────────────────────────────────────

class ResumeOptimizeRequest(BaseModel):
    jd_text: str
    resume_text: str
