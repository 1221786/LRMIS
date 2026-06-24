from typing import Literal

from pydantic import BaseModel, Field, field_validator


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]

    @field_validator("coordinates")
    @classmethod
    def validate_polygon(cls, value: list[list[list[float]]]) -> list[list[list[float]]]:
        if not value or not value[0] or len(value[0]) < 4:
            raise ValueError("GeoJSON Polygon must contain at least four coordinate pairs")
        first = value[0][0]
        last = value[0][-1]
        if first != last:
            raise ValueError("GeoJSON Polygon ring must be closed")
        return value


class Parcel(BaseModel):
    parcel_number: str = Field(..., min_length=1)
    zone_id: str = Field(..., min_length=1)
    geometry: GeoJSONPolygon

