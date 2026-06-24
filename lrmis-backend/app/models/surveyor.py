from pydantic import BaseModel
from typing import Optional, Literal


class Surveyor(BaseModel):
    name: str
    phone: str
    region: str

    # 🗺 GIS Coordinates
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # 📊 Status
    status: Literal["available", "busy"] = "available"

    # ⚖️ Workload for smart assignment
    workload: int = 0