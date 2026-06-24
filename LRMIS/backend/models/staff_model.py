from pydantic import BaseModel, Field


class StaffCreate(BaseModel):
    staff_code: str
    name: str = Field(..., min_length=2)
    role: str
    department: str = "Land Registration"
    skills: list[str] = []
    zone_ids: list[str] = ["ZONE-RM-01"]
    phone: str = "+970599111111"
    email: str = "staff@example.com"
    max_tasks: int = 10

