from enum import Enum

from pydantic import BaseModel, Field


class StaffRole(str, Enum):
    staff = "staff"
    registrar = "registrar"
    surveyor = "surveyor"
    manager = "manager"


class Workload(BaseModel):
    active_tasks: int = 0
    max_tasks: int = 10


class Staff(BaseModel):
    staff_code: str = Field(..., min_length=2)
    role: StaffRole
    skills: list[str] = []
    workload: Workload = Workload()
    zones: list[str] = []

