from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.database import db, serialize_object_id
from app.services.auth import require_roles
from app.services.workflow import WorkflowError, get_application, log_action, now

router = APIRouter(tags=["Survey"])


class StaffCreate(BaseModel):
    staff_code: str = Field(..., min_length=2)
    name: str = Field(..., min_length=2)
    role: str
    department: str = "Land Registration"
    skills: list[str] = []
    coverage: dict = {}
    workload: dict = {"active_tasks": 0, "max_tasks": 10}
    zones: list[str] = []
    zone_ids: list[str] = []
    geo_fence: dict | None = None
    schedule: dict = {"working_days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], "hours": "08:00-15:00"}
    availability: dict = {"active": True}
    contacts: dict = {}
    active: bool = True

    @model_validator(mode="after")
    def validate_staff(self):
        if self.role not in {"surveyor", "registrar", "staff", "manager"}:
            raise ValueError("role must be surveyor, registrar, staff, or manager")
        self.zone_ids = self.zone_ids or self.zones
        self.zones = self.zones or self.zone_ids
        if not self.zones:
            raise ValueError("coverage zones are required")
        return self


class SurveyMilestoneInput(BaseModel):
    milestone: str
    scheduled_date: str | None = None
    notes: str | None = None
    note: str | None = None
    field_notes: str | None = None
    actor: dict | None = None


class SurveyReportInput(BaseModel):
    report_type: str = "field_survey"
    file_name: str = "survey_report.pdf"
    file_url: str = "/uploads/survey_report.pdf"
    summary: str
    findings: dict = {}
    attachments: list[dict] = []
    actor: dict | None = None


class FieldNoteInput(BaseModel):
    note: str = Field(..., min_length=1)
    actor: dict | None = None


MILESTONES = ["assigned", "visit_scheduled", "arrived_on_site", "survey_started", "survey_completed", "report_uploaded", "registrar_reviewed"]


def staff_query(staff_id: str) -> dict:
    try:
        return {"$or": [{"_id": ObjectId(staff_id)}, {"staff_code": staff_id}]}
    except Exception:
        return {"staff_code": staff_id}


def enrich_survey_task(task: dict) -> dict:
    application = None
    parcel = None
    application_id = task.get("application_id")
    if application_id:
        try:
            application = db.land_applications.find_one({"_id": ObjectId(application_id)})
        except Exception:
            application = db.land_applications.find_one({"application_id": application_id})
    if not application and task.get("application_number"):
        application = db.land_applications.find_one({"application_id": task["application_number"]})

    parcel_ref = task.get("parcel_ref") or {}
    if application:
        parcel_ref = {**(application.get("parcel_ref") or {}), **parcel_ref}
        task["application_number"] = task.get("application_number") or application.get("application_id")

    parcel_id = task.get("parcel_id") or parcel_ref.get("parcel_id")
    if parcel_id:
        try:
            parcel = db.parcels.find_one({"_id": ObjectId(parcel_id)})
        except Exception:
            parcel = None
    if not parcel and parcel_ref.get("parcel_number"):
        parcel = db.parcels.find_one(
            {
                "parcel_number": parcel_ref.get("parcel_number"),
                "zone_id": parcel_ref.get("zone_id"),
            }
        )

    if parcel:
        parcel_ref = {
            **parcel_ref,
            "parcel_id": str(parcel["_id"]),
            "parcel_number": parcel.get("parcel_number"),
            "block_number": parcel.get("block_number"),
            "basin_number": parcel.get("basin_number"),
            "zone_id": parcel.get("zone_id"),
        }

    task["parcel_ref"] = parcel_ref
    task["parcel_number"] = parcel_ref.get("parcel_number")
    task["block_number"] = parcel_ref.get("block_number")
    task["basin_number"] = parcel_ref.get("basin_number")
    task["zone_id"] = parcel_ref.get("zone_id")
    return task


def next_task_id() -> str:
    return f"SURV-2026-{db.survey_tasks.count_documents({}) + 1:04d}"


def survey_skill_required(application_type: str) -> str:
    if application_type in {"parcel_subdivision", "parcel_merge", "boundary_correction"}:
        return "boundary_survey"
    return "gps_mapping"


@router.post("/staff/")
def create_staff(payload: StaffCreate, user: dict = Depends(require_roles("staff"))):
    existing = db.staff_members.find_one({"staff_code": payload.staff_code})
    if existing:
        return serialize_object_id(existing)

    staff = payload.model_dump()
    staff["created_at"] = now()
    staff["updated_at"] = now()
    result = db.staff_members.insert_one(staff)
    staff["_id"] = result.inserted_id
    return serialize_object_id(staff)


@router.get("/staff/{staff_id}")
def get_staff(staff_id: str, user: dict = Depends(require_roles("staff", "surveyor"))):
    staff = db.staff_members.find_one(staff_query(staff_id))
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    if user["role"] == "surveyor" and user["linked_id"] != str(staff["_id"]):
        raise HTTPException(status_code=403, detail="Surveyors can only access their own tasks")
    tasks = [enrich_survey_task(task) for task in db.survey_tasks.find({"assigned_surveyor": str(staff["_id"])})]
    staff["survey_tasks"] = tasks
    staff["performance_summary"] = {
        "assigned_tasks": len(tasks),
        "completed_tasks": sum(1 for task in tasks if task.get("status") in {"survey_completed", "report_uploaded", "registrar_reviewed"}),
        "reports_uploaded": sum(1 for task in tasks if task.get("report_uploaded")),
    }
    return serialize_object_id(staff)


@router.post("/applications/{application_id}/auto-assign-surveyor")
def auto_assign_surveyor(application_id: str, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if application.get("status") != "survey_required":
        raise HTTPException(status_code=400, detail="Application must be survey_required before auto assignment")
    existing_task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    if existing_task:
        return serialize_object_id({"surveyor": db.staff_members.find_one({"_id": ObjectId(existing_task["assigned_surveyor"])}), "survey_task": existing_task})

    zone_id = application["parcel_ref"]["zone_id"]
    required_skill = survey_skill_required(application.get("type", "ownership_transfer"))

    candidates = list(
        db.staff_members.find(
            {
                "role": "surveyor",
                "$or": [{"zone_ids": zone_id}, {"zones": zone_id}],
                "active": {"$ne": False},
                "availability.active": True,
                "skills": required_skill,
                "$expr": {"$lt": ["$workload.active_tasks", "$workload.max_tasks"]},
            }
        ).sort([("workload.active_tasks", 1), ("workload.max_tasks", -1)])
    )
    if not candidates:
        raise HTTPException(status_code=400, detail="No available surveyor matches zone, workload, skills, and availability")

    surveyor = candidates[0]
    task = {
        "task_id": next_task_id(),
        "application_id": str(application["_id"]),
        "application_number": application["application_id"],
        "parcel_id": application["parcel_ref"]["parcel_id"],
        "parcel_ref": application["parcel_ref"],
        "status": "assigned",
        "current_milestone": "assigned",
        "assigned_surveyor": str(surveyor["_id"]),
        "assigned_surveyor_id": str(surveyor["_id"]),
        "priority": application.get("priority", "normal"),
        "field_notes": [],
        "report_uploaded": False,
        "milestones": [
            {
                "milestone": "assigned",
                "at": now(),
                "notes": "Auto assigned by zone, workload, skills, and availability",
            }
        ],
        "created_at": now(),
        "updated_at": now(),
    }
    result = db.survey_tasks.insert_one(task)
    task["_id"] = result.inserted_id

    db.staff_members.update_one(
        {"_id": surveyor["_id"]},
        {"$inc": {"workload.active_tasks": 1}, "$set": {"updated_at": now()}},
    )
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "assignment.assigned_surveyor": str(surveyor["_id"]),
                "assignment.survey_task_id": str(result.inserted_id),
                "updated_at": now(),
            }
        },
    )
    log_action(
        application,
        "survey_assigned",
        actor={"role": "system", "id": None},
        metadata={"surveyor_id": str(surveyor["_id"]), "task_id": task["task_id"]},
    )
    return serialize_object_id({"surveyor": surveyor, "survey_task": task})


@router.patch("/applications/{application_id}/survey-milestone")
def update_survey_milestone(application_id: str, payload: SurveyMilestoneInput, user: dict = Depends(require_roles("surveyor", "staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")
    if user["role"] == "surveyor" and user["linked_id"] != task["assigned_surveyor"]:
        raise HTTPException(status_code=403, detail="Surveyors can only update assigned tasks")
    current = task.get("current_milestone") or task.get("status", "assigned")
    if payload.milestone not in MILESTONES:
        raise HTTPException(status_code=422, detail="Invalid survey milestone")
    if MILESTONES.index(payload.milestone) != MILESTONES.index(current) + 1 and payload.milestone != current:
        raise HTTPException(status_code=400, detail=f"Cannot move from {current} to {payload.milestone}")

    milestone = {
        "milestone": payload.milestone,
        "scheduled_date": payload.scheduled_date,
        "at": now(),
        "notes": payload.notes or payload.note,
        "actor": payload.actor,
    }
    set_fields = {"status": payload.milestone, "current_milestone": payload.milestone, "updated_at": now()}
    push_fields = {"milestones": milestone}
    if payload.field_notes:
        push_fields["field_notes"] = {"note": payload.field_notes, "created_at": now(), "created_by": user["linked_id"]}
    db.survey_tasks.update_one(
        {"_id": task["_id"]},
        {"$set": set_fields, "$push": push_fields},
    )
    log_action(application, payload.milestone, actor=payload.actor, metadata={"milestone": payload.milestone})
    updated_task = db.survey_tasks.find_one({"_id": task["_id"]})
    return serialize_object_id(updated_task)


@router.post("/applications/{application_id}/survey-report")
def upload_survey_report(application_id: str, payload: SurveyReportInput, user: dict = Depends(require_roles("surveyor", "staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")
    if user["role"] == "surveyor" and user["linked_id"] != task["assigned_surveyor"]:
        raise HTTPException(status_code=403, detail="Surveyors can only upload reports for assigned tasks")
    if task.get("current_milestone") != "survey_completed" and task.get("status") != "survey_completed":
        raise HTTPException(status_code=400, detail="Cannot upload report before survey_completed")

    report = {
        "report_id": f"RPT-2026-{db.survey_reports.count_documents({}) + 1:04d}",
        "application_id": str(application["_id"]),
        "application_number": application["application_id"],
        "parcel_id": application["parcel_ref"]["parcel_id"],
        "task_id": task["task_id"],
        "survey_task_id": str(task["_id"]),
        "uploaded_by": user["linked_id"],
        "assigned_surveyor": task["assigned_surveyor"],
        "report_type": payload.report_type,
        "file_name": payload.file_name,
        "file_url": payload.file_url,
        "summary": payload.summary,
        "findings": payload.findings,
        "attachments": payload.attachments,
        "uploaded_at": now(),
        "registrar_review_status": "pending",
        "created_at": now(),
    }
    result = db.survey_reports.insert_one(report)
    report["_id"] = result.inserted_id

    db.survey_tasks.update_one(
        {"_id": task["_id"]},
        {
            "$set": {"status": "report_uploaded", "current_milestone": "report_uploaded", "report_uploaded": True, "report_id": str(result.inserted_id), "updated_at": now()},
            "$push": {"milestones": {"milestone": "report_uploaded", "at": now(), "notes": "Survey report metadata uploaded", "actor": payload.actor}},
        },
    )
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {"$set": {"survey_report_exists": True, "updated_at": now()}},
    )
    log_action(application, "survey_report_uploaded", actor=payload.actor, metadata={"report_id": str(result.inserted_id)})
    return serialize_object_id(report)


@router.post("/applications/{application_id}/survey-field-notes")
def add_survey_field_note(application_id: str, payload: FieldNoteInput, user: dict = Depends(require_roles("surveyor", "staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")
    if user["role"] == "surveyor" and user["linked_id"] != task["assigned_surveyor"]:
        raise HTTPException(status_code=403, detail="Surveyors can only add notes to assigned tasks")

    note = {
        "note": payload.note,
        "created_at": now(),
        "created_by": user["linked_id"],
        "actor": payload.actor or {"role": user["role"], "id": user["linked_id"]},
    }
    db.survey_tasks.update_one(
        {"_id": task["_id"]},
        {"$push": {"field_notes": note}, "$set": {"updated_at": now()}},
    )
    db.notifications.insert_one(
        {
            "type": "survey_field_note",
            "recipient_type": "surveyor",
            "recipient_id": task["assigned_surveyor"],
            "application_id": str(application["_id"]),
            "application_number": application["application_id"],
            "subject": "Field note saved",
            "message": f"Field note added for {application['application_id']}: {payload.note}",
            "status": "created",
            "sent": False,
            "stub": True,
            "created_at": now(),
        }
    )
    log_action(application, "survey_field_note_added", actor=note["actor"], metadata={"note": payload.note})
    return serialize_object_id(db.survey_tasks.find_one({"_id": task["_id"]}))


@router.get("/applications/{application_id}/survey-field-notes")
def get_survey_field_notes(application_id: str, user: dict = Depends(require_roles("surveyor", "staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    if not task:
        raise HTTPException(status_code=404, detail="Survey task not found")
    if user["role"] == "surveyor" and user["linked_id"] != task["assigned_surveyor"]:
        raise HTTPException(status_code=403, detail="Surveyors can only read notes for assigned tasks")
    notes = task.get("field_notes") or []
    return serialize_object_id({"items": notes, "count": len(notes), "latest": notes[-1] if notes else None})


@router.get("/survey-tasks")
def list_survey_tasks(user: dict = Depends(require_roles("staff", "surveyor"))):
    query = {}
    if user["role"] == "surveyor":
        query["assigned_surveyor"] = user["linked_id"]
    tasks = [enrich_survey_task(task) for task in db.survey_tasks.find(query).sort("created_at", -1)]
    return serialize_object_id({"items": tasks, "count": len(tasks)})


@router.patch("/applications/{application_id}/survey-registrar-review")
def survey_registrar_review(application_id: str, decision: str, note: str | None = None, user: dict = Depends(require_roles("staff"))):
    try:
        application = get_application(application_id)
    except WorkflowError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    task = db.survey_tasks.find_one({"application_id": str(application["_id"])})
    if not task or task.get("current_milestone") != "report_uploaded":
        raise HTTPException(status_code=400, detail="Report must be uploaded before registrar survey review")
    db.survey_tasks.update_one(
        {"_id": task["_id"]},
        {
            "$set": {"status": "registrar_reviewed", "current_milestone": "registrar_reviewed", "registrar_review": {"decision": decision, "note": note, "reviewed_by": user["linked_id"], "reviewed_at": now()}},
            "$push": {"milestones": {"milestone": "registrar_reviewed", "at": now(), "notes": note, "actor": {"role": "staff", "id": user["linked_id"]}}},
        },
    )
    db.survey_reports.update_many({"application_id": str(application["_id"])}, {"$set": {"registrar_review_status": decision, "reviewed_by": user["linked_id"], "reviewed_at": now()}})
    log_action(application, "registrar_reviewed", actor={"role": "staff", "id": user["linked_id"]}, metadata={"decision": decision, "note": note})
    return serialize_object_id(db.survey_tasks.find_one({"_id": task["_id"]}))
