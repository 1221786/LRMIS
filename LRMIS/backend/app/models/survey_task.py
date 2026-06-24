from enum import Enum

from pydantic import BaseModel


class SurveyTaskStatus(str, Enum):
    assigned = "assigned"
    visit_scheduled = "visit_scheduled"
    arrived_on_site = "arrived_on_site"
    survey_started = "survey_started"
    survey_completed = "survey_completed"
    report_uploaded = "report_uploaded"


class Milestone(BaseModel):
    name: SurveyTaskStatus
    at: str | None = None
    notes: str | None = None


class SurveyTask(BaseModel):
    milestones: list[Milestone] = []
    status: SurveyTaskStatus = SurveyTaskStatus.assigned
    assigned_surveyor: str

