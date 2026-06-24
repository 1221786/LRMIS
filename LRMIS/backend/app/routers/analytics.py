from fastapi import APIRouter, Depends

from app.database import db, serialize_object_id
from app.services.auth import require_roles

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/kpis")
def get_kpis(user: dict = Depends(require_roles("staff", "surveyor"))):
    pipeline = [
        {
            "$facet": {
                "total": [{"$count": "count"}],
                "approved": [{"$match": {"status": "approved"}}, {"$count": "count"}],
                "rejected": [{"$match": {"status": "rejected"}}, {"$count": "count"}],
                "pending": [
                    {
                        "$match": {
                            "status": {
                                "$in": [
                                    "submitted",
                                    "pre_checked",
                                    "survey_required",
                                    "surveyed",
                                    "legal_review",
                                    "missing_documents",
                                    "under_objection",
                                    "on_hold",
                                ]
                            }
                        }
                    },
                    {"$count": "count"},
                ],
                "certificates": [{"$match": {"status": "certificate_issued"}}, {"$count": "count"}],
                "objections": [{"$match": {"status": "under_objection"}}, {"$count": "count"}],
                "delayed": [{"$match": {"priority": "urgent", "status": {"$nin": ["approved", "certificate_issued", "closed", "rejected"]}}}, {"$count": "count"}],
            }
        }
    ]
    result = list(db.land_applications.aggregate(pipeline))[0]
    return {
        "total_applications": count_value(result["total"]),
        "approved": count_value(result["approved"]),
        "rejected": count_value(result["rejected"]),
        "pending": count_value(result["pending"]),
        "certificates_issued": count_value(result["certificates"]),
        "under_objection": count_value(result["objections"]),
        "delayed_applications": count_value(result["delayed"]),
    }


@router.get("/applications-by-status")
def applications_by_status(user: dict = Depends(require_roles("staff", "surveyor"))):
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    return serialize_object_id(list(db.land_applications.aggregate(pipeline)))


@router.get("/applications-by-zone")
def applications_by_zone(user: dict = Depends(require_roles("staff", "surveyor"))):
    pipeline = [
        {"$group": {"_id": "$parcel_ref.zone_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    return serialize_object_id(list(db.land_applications.aggregate(pipeline)))


@router.get("/processing-time")
def processing_time(user: dict = Depends(require_roles("staff", "surveyor"))):
    pipeline = [
        {"$match": {"created_at": {"$exists": True}, "updated_at": {"$exists": True}}},
        {
            "$project": {
                "type": 1,
                "status": 1,
                "processing_hours": {
                    "$dateDiff": {
                        "startDate": "$created_at",
                        "endDate": "$updated_at",
                        "unit": "hour",
                    }
                },
            }
        },
        {
            "$group": {
                "_id": "$type",
                "avg_processing_hours": {"$avg": "$processing_hours"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"avg_processing_hours": -1}},
    ]
    return serialize_object_id(list(db.land_applications.aggregate(pipeline)))


@router.get("/surveyors")
def surveyors(user: dict = Depends(require_roles("staff", "surveyor"))):
    pipeline = [
        {"$match": {"role": "surveyor"}},
        {
            "$lookup": {
                "from": "survey_tasks",
                "localField": "_id",
                "foreignField": "assigned_surveyor",
                "as": "tasks_by_object_id",
            }
        },
        {
            "$project": {
                "staff_code": 1,
                "role": 1,
                "skills": 1,
                "zones": 1,
                "workload": 1,
                "availability": 1,
                "task_count": {"$size": "$tasks_by_object_id"},
            }
        },
        {"$sort": {"workload.active_tasks": 1}},
    ]
    result = list(db.staff_members.aggregate(pipeline))

    # assigned_surveyor is stored as string in the survey module, so include a string-based count too.
    for surveyor in result:
        surveyor["task_count"] = db.survey_tasks.count_documents({"assigned_surveyor": str(surveyor["_id"])})
    return serialize_object_id(result)


@router.get("/registrars")
def registrars(user: dict = Depends(require_roles("staff"))):
    pipeline = [
        {"$match": {"role": {"$in": ["registrar", "staff", "manager"]}}},
        {
            "$lookup": {
                "from": "land_applications",
                "localField": "_id",
                "foreignField": "assignment.assigned_registrar",
                "as": "assigned_applications",
            }
        },
        {
            "$project": {
                "staff_code": 1,
                "name": 1,
                "role": 1,
                "department": 1,
                "workload": 1,
                "zones": 1,
                "active": 1,
                "review_workload": {"$size": "$assigned_applications"},
            }
        },
        {"$sort": {"review_workload": -1}},
    ]
    return serialize_object_id(list(db.staff_members.aggregate(pipeline)))


@router.get("/geofeeds/parcels")
def parcel_geofeed(user: dict = Depends(require_roles("staff", "surveyor"))):
    parcels = list(db.parcels.find({}))
    features = []
    for parcel in parcels:
        application = db.land_applications.find_one(
            {
                "$or": [
                    {"parcel_ref.parcel_id": str(parcel["_id"])},
                    {"parcel_ref.parcel_number": parcel.get("parcel_number")},
                ]
            }
        )
        features.append(
            {
                "type": "Feature",
                "geometry": parcel.get("geometry"),
                "properties": {
                    "parcel_id": str(parcel["_id"]),
                    "parcel_number": parcel.get("parcel_number"),
                    "zone_id": parcel.get("zone_id"),
                    "application_id": application.get("application_id") if application else None,
                    "status": application.get("status") if application else "no_application",
                    "type": application.get("type") if application else None,
                    "dispute_state": parcel.get("dispute_state", "none"),
                },
            }
        )
    return serialize_object_id({"type": "FeatureCollection", "features": features})


@router.get("/geofeeds/pending-heatmap")
def pending_heatmap(user: dict = Depends(require_roles("staff", "surveyor"))):
    pipeline = [
        {
            "$match": {
                "status": {
                    "$in": ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review", "missing_documents", "under_objection", "on_hold"]
                }
            }
        },
        {
            "$project": {
                "application_id": 1,
                "status": 1,
                "parcel_number": "$parcel_ref.parcel_number",
                "zone_id": "$parcel_ref.zone_id",
                "parcel_id": "$parcel_ref.parcel_id",
            }
        },
    ]
    applications = list(db.land_applications.aggregate(pipeline))
    features = []
    for application in applications:
        parcel = db.parcels.find_one(
            {
                "$or": [
                    {"_id": safe_object_id(application.get("parcel_id"))},
                    {"parcel_number": application.get("parcel_number"), "zone_id": application.get("zone_id")},
                ]
            }
        )
        if not parcel or not parcel.get("geometry"):
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": parcel["geometry"],
                "properties": {
                    "application_id": application["application_id"],
                    "status": application["status"],
                    "weight": heatmap_weight(application["status"]),
                },
            }
        )
    return serialize_object_id({"type": "FeatureCollection", "features": features})


def count_value(items: list[dict]) -> int:
    return items[0]["count"] if items else 0


def heatmap_weight(status: str) -> int:
    return {
        "under_objection": 5,
        "missing_documents": 4,
        "survey_required": 3,
        "legal_review": 2,
    }.get(status, 1)


def safe_object_id(value):
    from bson import ObjectId

    try:
        return ObjectId(value)
    except Exception:
        return None
