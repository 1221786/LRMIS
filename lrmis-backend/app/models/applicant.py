from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class Applicant(BaseModel):
    name: str
    national_id: str
    phone: str
    email: Optional[str] = None

    # 🗺 GIS Coordinates
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # 📊 Workflow Status
    status: Literal[
        "submitted",
        "assigned",
        "survey_in_progress",
        "survey_completed",
        "verified",
        "approved",
        "rejected"
    ] = "submitted"

    # 🕒 Timestamp (created when applicant is created)
    created_at: datetime = datetime.utcnow()