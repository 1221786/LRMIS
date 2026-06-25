from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import db, serialize_object_id
from app.services.auth import require_roles

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class ManagementReportInput(BaseModel):
    report_type: str
    date_from: str
    date_to: str
    zone: str = "all"
    format: str = "pdf"


REPORT_NAMES = {
    "applications_summary": "Applications Summary",
    "surveyor_performance": "Surveyor Performance",
    "registrar_performance": "Registrar Performance",
    "hotspot_zones": "Hotspot Zones",
}


def report_date_match(payload: ManagementReportInput, field: str = "created_at") -> dict:
    start = datetime.fromisoformat(payload.date_from).replace(tzinfo=timezone.utc)
    end = datetime.combine(datetime.fromisoformat(payload.date_to).date(), time.max, tzinfo=timezone.utc)
    return {field: {"$gte": start, "$lte": end}}


@router.post("/management-reports")
def generate_management_report(payload: ManagementReportInput, user: dict = Depends(require_roles("staff", "surveyor"))):
    if payload.report_type not in REPORT_NAMES:
        raise HTTPException(status_code=422, detail="Invalid report type")
    if payload.format not in {"pdf", "csv"}:
        raise HTTPException(status_code=422, detail="Format must be pdf or csv")

    app_match = report_date_match(payload)
    if payload.zone != "all":
        app_match["parcel_ref.zone_id"] = payload.zone
    rows = []

    if payload.report_type == "applications_summary":
        rows = list(db.land_applications.aggregate([
            {"$match": app_match},
            {"$group": {"_id": {"status": "$status", "type": "$type"}, "count": {"$sum": 1}}},
            {"$sort": {"_id.status": 1, "_id.type": 1}},
        ]))
    elif payload.report_type == "surveyor_performance":
        task_match = report_date_match(payload)
        if payload.zone != "all":
            task_match["parcel_ref.zone_id"] = payload.zone
        rows = list(db.survey_tasks.aggregate([
            {"$match": task_match},
            {"$group": {
                "_id": "$assigned_surveyor",
                "assigned": {"$sum": 1},
                "completed": {"$sum": {"$cond": [{"$in": ["$status", ["survey_completed", "report_uploaded", "registrar_reviewed"]]}, 1, 0]}},
            }},
        ]))
        for row in rows:
            staff = db.staff_members.find_one({"_id": ObjectId(row["_id"])}) if ObjectId.is_valid(row.get("_id", "")) else None
            row["name"] = (staff or {}).get("name") or row["_id"]
    elif payload.report_type == "registrar_performance":
        rows = list(db.performance_logs.aggregate([
            {"$unwind": "$event_stream"},
            {"$match": {
                "event_stream.at": report_date_match(payload, "event_stream.at")["event_stream.at"],
                "event_stream.type": {"$in": ["registrar_reviewed", "survey_report_rejected", "registrar_review"]},
            }},
            {"$group": {
                "_id": "$event_stream.by.id",
                "reviewed": {"$sum": 1},
                "approved": {"$sum": {"$cond": [{"$eq": ["$event_stream.metadata.decision", "approve"]}, 1, 0]}},
                "rejected": {"$sum": {"$cond": [{"$eq": ["$event_stream.metadata.decision", "reject"]}, 1, 0]}},
            }},
        ]))
        for row in rows:
            staff = db.staff_members.find_one({"_id": ObjectId(row["_id"])}) if ObjectId.is_valid(row.get("_id", "")) else None
            row["name"] = (staff or {}).get("name") or row["_id"]
    else:
        rows = list(db.land_applications.aggregate([
            {"$match": app_match},
            {"$group": {
                "_id": "$parcel_ref.zone_id",
                "applications": {"$sum": 1},
                "objections": {"$sum": {"$cond": [{"$eq": ["$status", "under_objection"]}, 1, 0]}},
                "survey_required": {"$sum": {"$cond": [{"$eq": ["$status", "survey_required"]}, 1, 0]}},
            }},
            {"$sort": {"applications": -1}},
        ]))

    generated = {
        "report_name": REPORT_NAMES[payload.report_type],
        "report_type": payload.report_type,
        "category": "Analytics" if payload.report_type == "hotspot_zones" else "Performance" if "performance" in payload.report_type else "Summary",
        "date_from": payload.date_from,
        "date_to": payload.date_to,
        "zone": payload.zone,
        "format": payload.format.upper(),
        "rows": serialize_object_id(rows),
        "generated_by": user["linked_id"],
        "created_at": datetime.now(timezone.utc),
    }
    result = db.generated_reports.insert_one(generated)
    generated["_id"] = result.inserted_id
    return serialize_object_id(generated)


@router.get("/management-reports")
def list_management_reports(user: dict = Depends(require_roles("staff", "surveyor"))):
    rows = list(db.generated_reports.find({}).sort("created_at", -1).limit(30))
    return serialize_object_id({"items": rows, "count": len(rows)})


@router.get("/dashboard")
def analytics_dashboard(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    user: dict = Depends(require_roles("staff", "surveyor")),
):
    match = date_range_match(date_from, date_to, "created_at")
    pending_statuses = ["submitted", "pre_checked", "survey_required", "surveyed", "legal_review", "missing_documents", "under_objection", "on_hold"]
    applications_over_time = list(db.land_applications.aggregate([
        {"$match": match},
        {"$match": {"status": {"$in": ["submitted", "approved", "rejected"]}}},
        {"$group": {"_id": {"month": {"$dateToString": {"format": "%Y-%m", "date": "$created_at"}}, "status": "$status"}, "count": {"$sum": 1}}},
        {"$sort": {"_id.month": 1}},
    ]))
    pending_by_zone = list(db.land_applications.aggregate([
        {"$match": {**match, "status": {"$in": pending_statuses}}},
        {"$group": {"_id": "$parcel_ref.zone_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    closed_match = {**match, "status": {"$in": ["closed", "certificate_issued"]}, "created_at": {"$exists": True}, "updated_at": {"$exists": True}}
    if "created_at" in match:
        closed_match["created_at"] = {**match["created_at"], "$exists": True}
    processing = list(db.land_applications.aggregate([
        {"$match": closed_match},
        {"$project": {"days": {"$dateDiff": {"startDate": "$created_at", "endDate": "$updated_at", "unit": "day"}}}},
        {"$group": {"_id": None, "average_days": {"$avg": "$days"}, "count": {"$sum": 1}}},
    ]))
    objection_match = date_range_match(date_from, date_to, "created_at")
    objections = list(db.objections.aggregate([
        {"$match": objection_match},
        {"$group": {"_id": {"$ifNull": ["$objection_type", "$reason"]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    certificate_match = date_range_match(date_from, date_to, "issued_at")
    certificates = list(db.certificates.aggregate([
        {"$match": certificate_match},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m", "date": "$issued_at"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]))
    surveyors = []
    task_match = date_range_match(date_from, date_to, "created_at")
    for staff in db.staff_members.find({"role": "surveyor"}):
        surveyors.append({
            "_id": str(staff["_id"]),
            "label": staff.get("name") or staff.get("full_name") or staff.get("staff_code"),
            "count": db.survey_tasks.count_documents({"assigned_surveyor": str(staff["_id"]), **task_match}),
        })
    surveyors.sort(key=lambda item: item["count"], reverse=True)
    return serialize_object_id({
        "applications_over_time": applications_over_time,
        "pending_by_zone": pending_by_zone,
        "average_processing_days": round(processing[0]["average_days"], 1) if processing else 0,
        "surveyor_workload": surveyors,
        "objections_by_type": objections,
        "certificates_by_month": certificates,
    })


def date_range_match(date_from: str | None, date_to: str | None, field: str) -> dict:
    if not date_from and not date_to:
        return {}
    value = {}
    if date_from:
        value["$gte"] = datetime.combine(datetime.fromisoformat(date_from).date(), time.min, tzinfo=timezone.utc)
    if date_to:
        value["$lte"] = datetime.combine(datetime.fromisoformat(date_to).date(), time.max, tzinfo=timezone.utc)
    return {field: value}


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
