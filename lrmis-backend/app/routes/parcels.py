from fastapi import APIRouter
from app.core.database import db
from datetime import datetime

router = APIRouter()

parcels = db["parcels"]

# 🟢 CREATE PARCEL (GeoJSON)
@router.post("/parcels")
def create_parcel(parcel: dict):

    data = {
        "parcel_code": parcel.get("parcel_code"),
        "zone": parcel.get("zone"),
        "type": parcel.get("type"),
        "geometry": parcel.get("geometry"),  # GeoJSON
        "created_at": datetime.utcnow()
    }

    parcels.insert_one(data)

    return {"message": "Parcel created"}