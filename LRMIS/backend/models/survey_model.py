from pydantic import BaseModel, Field


class SurveyMilestoneRequest(BaseModel):
    milestone: str
    scheduled_date: str | None = None
    note: str | None = None


class SurveyReportCreate(BaseModel):
    report_number: str | None = None
    summary: str = Field(..., min_length=3)
    boundary_matches: bool = True
    area_sqm_measured: float
    has_dispute: bool = False
    attachments: list[dict] = []

