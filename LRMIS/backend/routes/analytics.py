from fastapi import APIRouter

from database import db, serialize_doc
from services.analytics_service import kpis, status_counts, zone_counts

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/kpis")
def get_kpis():
    return serialize_doc(kpis(db))


@router.get("/applications-by-status")
def applications_by_status():
    return serialize_doc(status_counts(db))


@router.get("/applications-by-zone")
def applications_by_zone():
    return serialize_doc(zone_counts(db))


@router.get("/processing-time")
def processing_time():
    pipeline = [
        {"$match": {"timestamps.closed_at": {"$ne": None}}},
        {"$project": {"application_type": 1, "processing_days": {"$dateDiff": {"startDate": "$timestamps.submitted_at", "endDate": "$timestamps.closed_at", "unit": "day"}}}},
        {"$group": {"_id": "$application_type", "avg_processing_days": {"$avg": "$processing_days"}}},
    ]
    return serialize_doc(list(db.land_applications.aggregate(pipeline)))


@router.get("/surveyors")
def surveyors():
    return serialize_doc(list(db.staff_members.find({"role": "surveyor"}, {"name": 1, "staff_code": 1, "workload": 1})))


@router.get("/registrars")
def registrars():
    return serialize_doc(list(db.staff_members.find({"role": {"$in": ["registrar", "manager", "staff"]}}, {"name": 1, "staff_code": 1, "workload": 1, "role": 1})))


@router.get("/geofeeds/parcels")
def parcels_geojson():
    features = []
    for parcel in db.parcels.find({}):
        app = db.land_applications.find_one({"parcel_ref.parcel_id": parcel["_id"]})
        features.append(
            {
                "type": "Feature",
                "geometry": parcel["geometry"],
                "properties": {
                    "parcel_code": parcel.get("parcel_code"),
                    "parcel_number": parcel.get("parcel_number"),
                    "zone_id": parcel.get("zone_id"),
                    "registration_status": parcel.get("registration_status"),
                    "dispute_state": parcel.get("dispute_state", "none"),
                    "application_id": app.get("application_id") if app else None,
                    "application_status": app.get("status") if app else None,
                },
            }
        )
    return serialize_doc({"type": "FeatureCollection", "features": features})


@router.get("/geofeeds/pending-heatmap")
def pending_heatmap():
    apps = db.land_applications.find({"status": {"$in": ["submitted", "pre_checked", "survey_required", "under_objection"]}})
    points = []
    for app in apps:
        parcel = db.parcels.find_one({"_id": app["parcel_ref"]["parcel_id"]})
        if parcel:
            lng, lat = parcel["geometry"]["coordinates"][0][0]
            points.append({"lat": lat, "lng": lng, "weight": 1, "application_id": app["application_id"]})
    return serialize_doc(points)

