from pydantic import BaseModel, Field

from models.common import GeoJSONPolygon


class ParcelCreate(BaseModel):
    parcel_code: str | None = None
    parcel_number: str = Field(..., min_length=1)
    block_number: str = Field(..., min_length=1)
    basin_number: str = Field(..., min_length=1)
    zone_id: str = Field(..., min_length=1)
    area_sqm: float = Field(..., gt=0)
    land_use: str = "residential"
    registration_status: str = "registered"
    geometry: GeoJSONPolygon
    address_hint: str = "Ramallah"
    dispute_state: str = "none"

