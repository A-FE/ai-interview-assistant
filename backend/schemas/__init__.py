from datetime import datetime
from typing import Optional, List, Any, Dict
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


class JDSummary(BaseModel):
    """Structured summary extracted from JD at analysis time."""
    title: Optional[str] = None       # 岗位名称
    company: Optional[str] = None     # 公司名称
    core_stack: List[str] = []        # 核心技术栈
    level: Optional[str] = None       # 经验要求 e.g. 3-5年
    salary: Optional[str] = None      # 薪资范围 e.g. 20-35k
    city: Optional[str] = None        # 工作城市
    education: Optional[str] = None   # 学历要求 e.g. 本科及以上
    match_score: Optional[int] = None # 匹配分 0-100（仅有简历时）


class JDSessionResponse(BaseModel):
    id: int
    jd_text: str
    analysis_result: Optional[str] = None
    jd_summary: Optional[str] = None  # JSON string of JDSummary
    title: Optional[str] = None
    company: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class JDOCRRequest(BaseModel):
    image_base64: str   # base64-encoded image
    mime_type: str = "image/png"  # image/png | image/jpeg | image/webp


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


class ResumeResponse(BaseModel):
    id: int
    filename: str
    summary: Optional[str] = None   # JSON string
    status: str = "done"            # "parsing" | "done" | "failed"
    created_at: datetime

    class Config:
        from_attributes = True
