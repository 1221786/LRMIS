from bson import ObjectId

from services.log_service import add_log
from services.workflow_service import now


def next_task_id(db):
    count = db.survey_tasks.count_documents({}) + 1
    return f"SURV-2026-{count:04d}"


def auto_assign_surveyor(db, application):
    zone_id = application["parcel_ref"]["zone_id"]
    surveyor = db.staff_members.find_one(
        {
            "role": "surveyor",
            "active": True,
            "coverage.zone_ids": zone_id,
            "$expr": {"$lt": ["$workload.active_tasks", "$workload.max_tasks"]},
        },
        sort=[("workload.active_tasks", 1)],
    )
    if not surveyor:
        raise ValueError("No available surveyor for this zone")

    task = {
        "task_id": next_task_id(db),
        "application_id": application["_id"],
        "parcel_id": application["parcel_ref"]["parcel_id"],
        "assigned_surveyor_id": surveyor["_id"],
        "status": "assigned",
        "priority": application.get("priority", "normal"),
        "scheduled_visit_date": None,
        "milestones": [{"type": "assigned", "at": now(), "by": "system", "meta": {"reason": "zone and workload match"}}],
        "field_notes": [],
        "report_uploaded": False,
        "created_at": now(),
        "updated_at": now(),
    }
    result = db.survey_tasks.insert_one(task)
    db.staff_members.update_one({"_id": surveyor["_id"]}, {"$inc": {"workload.active_tasks": 1}})
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "assignment.assigned_surveyor_id": surveyor["_id"],
                "assignment.assignment_policy": "zone+workload+availability",
                "timestamps.updated_at": now(),
            }
        },
    )
    add_log(db, application["_id"], "surveyor_assigned", meta={"task_id": task["task_id"], "surveyor": surveyor["name"]})
    task["_id"] = result.inserted_id
    return {"task": task, "surveyor": surveyor}

