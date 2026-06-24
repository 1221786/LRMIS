from datetime import datetime, timedelta, timezone

from app.database import db, serialize_object_id
from app.services.auth import hash_password
from app.services.indexes import create_indexes


def now() -> datetime:
    return datetime.now(timezone.utc)


def seed_sample_data() -> dict:
    create_indexes(db)

    applicant = {
        "full_name": "Nour Ahmad",
        "national_id": "400000000",
        "contacts": {"email": "nour@example.com", "phone": "+970599000000"},
        "address": {"city": "Ramallah", "area": "Al Tireh", "street": "Main Street"},
        "type": "citizen",
        "created_at": now(),
    }
    db.applicants.update_one({"national_id": applicant["national_id"]}, {"$set": applicant}, upsert=True)
    applicant_doc = db.applicants.find_one({"national_id": applicant["national_id"]})

    parcel = {
        "parcel_code": "ZONE-RM-01-B12-BA3-P145",
        "parcel_number": "145",
        "block_number": "12",
        "basin_number": "3",
        "zone_id": "ZONE-RM-01",
        "current_owner_refs": [str(applicant_doc["_id"])],
        "area_sqm": 600.5,
        "land_use": "residential",
        "registration_status": "registered",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [35.2001, 31.9021],
                    [35.2015, 31.9021],
                    [35.2015, 31.9030],
                    [35.2001, 31.9030],
                    [35.2001, 31.9021],
                ]
            ],
        },
        "dispute_state": "none",
        "created_at": now(),
    }
    db.parcels.update_one({"parcel_number": parcel["parcel_number"], "zone_id": parcel["zone_id"]}, {"$set": parcel}, upsert=True)
    parcel_doc = db.parcels.find_one({"parcel_number": parcel["parcel_number"], "zone_id": parcel["zone_id"]})

    registrar = {
        "staff_code": "REG-RM-01",
        "name": "Omar Al-Registrar",
        "role": "staff",
        "department": "Registrar Office",
        "skills": ["legal_review", "workflow_review", "certificate_issuance"],
        "coverage": {"zones": ["ZONE-RM-01"]},
        "workload": {"active_tasks": 0, "max_tasks": 25},
        "zones": ["ZONE-RM-01"],
        "zone_ids": ["ZONE-RM-01"],
        "geo_fence": None,
        "schedule": {"working_days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], "hours": "08:00-15:00"},
        "availability": {"active": True},
        "contacts": {"email": "registrar@example.com", "phone": "+970599000010"},
        "active": True,
        "created_at": now(),
    }
    db.staff_members.update_one({"staff_code": registrar["staff_code"]}, {"$set": registrar}, upsert=True)
    registrar_doc = db.staff_members.find_one({"staff_code": registrar["staff_code"]})

    staff = {
        "staff_code": "SURV-RM-01",
        "name": "Hassan Surveyor",
        "role": "surveyor",
        "department": "Field Survey",
        "skills": ["boundary_survey", "gps_mapping"],
        "coverage": {"zones": ["ZONE-RM-01"]},
        "workload": {"active_tasks": 0, "max_tasks": 10},
        "zones": ["ZONE-RM-01"],
        "zone_ids": ["ZONE-RM-01"],
        "geo_fence": None,
        "schedule": {"working_days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], "hours": "08:00-15:00"},
        "availability": {"active": True},
        "contacts": {"email": "surveyor@example.com", "phone": "+970599000011"},
        "active": True,
        "created_at": now(),
    }
    db.staff_members.update_one({"staff_code": staff["staff_code"]}, {"$set": staff}, upsert=True)
    staff_doc = db.staff_members.find_one({"staff_code": staff["staff_code"]})

    application = {
        "application_id": "LRMIS-2026-0001",
        "application_type": "ownership_transfer",
        "type": "ownership_transfer",
        "status": "submitted",
        "priority": "normal",
        "description": "Ownership transfer application for parcel 145.",
        "workflow": {"current_state": "submitted", "allowed_next": ["pre_checked", "missing_documents", "rejected", "on_hold"]},
        "parcel_ref": {
            "parcel_id": str(parcel_doc["_id"]),
            "parcel_code": parcel_doc["parcel_code"],
            "parcel_number": parcel_doc["parcel_number"],
            "block_number": parcel_doc["block_number"],
            "basin_number": parcel_doc["basin_number"],
            "zone_id": parcel_doc["zone_id"],
        },
        "applicant_ref": {
            "applicant_id": str(applicant_doc["_id"]),
            "full_name": applicant_doc["full_name"],
        },
        "required_documents": [
            {"document_type": "id_copy", "required": True, "status": "pending_review", "file_name": "id.pdf", "file_url": "/uploads/id.pdf"},
            {"document_type": "ownership_deed", "required": True, "status": "pending_review", "file_name": "deed.pdf", "file_url": "/uploads/deed.pdf"},
            {"document_type": "sale_contract", "required": True, "status": "missing", "file_name": None, "file_url": None},
        ],
        "documents": [
            {"document_type": "id_copy", "status": "pending_review", "file_name": "id.pdf", "file_url": "/uploads/id.pdf"},
            {"document_type": "ownership_deed", "status": "pending_review", "file_name": "deed.pdf", "file_url": "/uploads/deed.pdf"},
        ],
        "assignment": {"assigned_surveyor": None, "assigned_registrar": None},
        "objection": {"has_objection": False, "objection_ids": []},
        "internal": {"notes": [], "visible_registrar_notes": []},
        "timestamps": {"submitted_at": now(), "updated_at": now()},
        "created_at": now(),
        "updated_at": now(),
    }
    db.land_applications.update_one({"application_id": application["application_id"]}, {"$set": application}, upsert=True)
    application_doc = db.land_applications.find_one({"application_id": application["application_id"]})

    student2_samples = [
        ("LRMIS-2025-0001", "ownership_transfer", "145/12", "12", "3", "ZONE-RM-01", "pre_checked", 0),
        ("LRMIS-2025-0002", "first_registration", "146/7", "7", "4", "ZONE-RM-01", "submitted", 1),
        ("LRMIS-2025-0003", "parcel_subdivision", "147/3-4", "3", "4", "ZONE-RM-02", "survey_required", 32),
        ("LRMIS-2025-0004", "parcel_merge", "148/2-3", "2", "3", "ZONE-RM-02", "surveyed", 2),
        ("LRMIS-2025-0005", "boundary_correction", "149/1", "1", "1", "ZONE-RM-03", "legal_review", 3),
    ]
    linked_ids = [str(application_doc["_id"])]
    for index, (application_id, app_type, parcel_number, block_number, basin_number, zone_id, status, days_ago) in enumerate(student2_samples, start=1):
        sample_parcel = {
            "parcel_code": f"{zone_id}-B{block_number}-BA{basin_number}-P{parcel_number.replace('/', '-')}",
            "parcel_number": parcel_number,
            "block_number": block_number,
            "basin_number": basin_number,
            "zone_id": zone_id,
            "current_owner_refs": [str(applicant_doc["_id"])],
            "area_sqm": 550 + (index * 30),
            "land_use": "residential",
            "registration_status": "registered",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[35.20 + index / 1000, 31.90], [35.201 + index / 1000, 31.90], [35.201 + index / 1000, 31.901], [35.20 + index / 1000, 31.901], [35.20 + index / 1000, 31.90]]],
            },
            "dispute_state": "none",
            "created_at": now(),
        }
        db.parcels.update_one(
            {"parcel_number": sample_parcel["parcel_number"], "zone_id": sample_parcel["zone_id"]},
            {"$setOnInsert": sample_parcel},
            upsert=True,
        )
        sample_parcel_doc = db.parcels.find_one({"parcel_number": parcel_number, "zone_id": zone_id})
        created_at = now() - timedelta(days=days_ago)
        sample_application = {
            "application_id": application_id,
            "application_type": app_type,
            "type": app_type,
            "status": status,
            "priority": "normal",
            "description": f"Student 2 linked application sample {application_id}.",
            "workflow": {"current_state": status, "allowed_next": []},
            "parcel_ref": {
                "parcel_id": str(sample_parcel_doc["_id"]),
                "parcel_code": sample_parcel_doc["parcel_code"],
                "parcel_number": sample_parcel_doc["parcel_number"],
                "block_number": sample_parcel_doc["block_number"],
                "basin_number": sample_parcel_doc["basin_number"],
                "zone_id": sample_parcel_doc["zone_id"],
            },
            "applicant_ref": {
                "applicant_id": str(applicant_doc["_id"]),
                "full_name": applicant_doc["full_name"],
                "national_id": applicant_doc["national_id"],
                "contacts": applicant_doc["contacts"],
                "address": applicant_doc["address"],
            },
            "required_documents": application["required_documents"],
            "documents": application["documents"],
            "assignment": {"assigned_surveyor": None, "assigned_registrar": str(registrar_doc["_id"])},
            "objection": {"has_objection": False, "objection_ids": []},
            "internal": {"notes": [], "visible_registrar_notes": []},
            "timestamps": {"submitted_at": created_at, "updated_at": created_at},
            "created_at": created_at,
            "updated_at": created_at,
        }
        db.land_applications.update_one(
            {"application_id": application_id},
            {"$setOnInsert": sample_application},
            upsert=True,
        )
        sample_doc = db.land_applications.find_one({"application_id": application_id})
        linked_ids.append(str(sample_doc["_id"]))
        db.performance_logs.update_one(
            {"application_id": str(sample_doc["_id"])},
            {"$setOnInsert": {"application_id": str(sample_doc["_id"]), "event_stream": [{"type": "application_submitted", "at": created_at, "by": {"role": "applicant", "id": str(applicant_doc["_id"])}}]}},
            upsert=True,
        )
    db.applicants.update_one(
        {"_id": applicant_doc["_id"]},
        {"$addToSet": {"linked_applications": {"$each": linked_ids}}, "$set": {"updated_at": now()}},
    )

    survey_task = {
        "task_id": "SURV-2026-0001",
        "application_id": str(application_doc["_id"]),
        "application_number": application_doc["application_id"],
        "parcel_id": str(parcel_doc["_id"]),
        "parcel_ref": application_doc["parcel_ref"],
        "milestones": [{"name": "assigned", "at": now().isoformat(), "notes": "Seed assignment"}],
        "status": "assigned",
        "current_milestone": "assigned",
        "assigned_surveyor": str(staff_doc["_id"]),
        "assigned_surveyor_id": str(staff_doc["_id"]),
        "priority": "normal",
        "field_notes": [],
        "report_uploaded": False,
        "created_at": now(),
    }
    db.survey_tasks.update_one({"application_id": survey_task["application_id"]}, {"$set": survey_task}, upsert=True)

    extra_survey_samples = [
        {
            "application_id": "LRMIS-2026-0002",
            "task_id": "SURV-2026-0002",
            "parcel": {
                "parcel_code": "ZONE-RM-02-B04-BA07-P290",
                "parcel_number": "290",
                "block_number": "04",
                "basin_number": "07",
                "zone_id": "ZONE-RM-02",
                "area_sqm": 740.0,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[35.2101, 31.9121], [35.2115, 31.9121], [35.2115, 31.9130], [35.2101, 31.9130], [35.2101, 31.9121]]],
                },
            },
            "priority": "medium",
            "current_milestone": "visit_scheduled",
            "milestones": [
                {"milestone": "assigned", "at": now(), "notes": "Assigned to surveyor"},
                {"milestone": "visit_scheduled", "scheduled_date": "2026-06-25", "at": now(), "notes": "Visit scheduled"},
            ],
        },
        {
            "application_id": "LRMIS-2026-0003",
            "task_id": "SURV-2026-0003",
            "parcel": {
                "parcel_code": "ZONE-RM-03-B01-BA04-P88",
                "parcel_number": "88",
                "block_number": "01",
                "basin_number": "04",
                "zone_id": "ZONE-RM-03",
                "area_sqm": 860.0,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[35.2201, 31.9221], [35.2215, 31.9221], [35.2215, 31.9230], [35.2201, 31.9230], [35.2201, 31.9221]]],
                },
            },
            "priority": "high",
            "current_milestone": "survey_started",
            "milestones": [
                {"milestone": "assigned", "at": now(), "notes": "Assigned to surveyor"},
                {"milestone": "visit_scheduled", "scheduled_date": "2026-06-26", "at": now(), "notes": "Visit scheduled"},
                {"milestone": "arrived_on_site", "at": now(), "notes": "Surveyor arrived on site"},
                {"milestone": "survey_started", "at": now(), "notes": "Survey started"},
            ],
        },
    ]

    for sample in extra_survey_samples:
        sample_parcel = {
            **sample["parcel"],
            "current_owner_refs": [str(applicant_doc["_id"])],
            "land_use": "residential",
            "registration_status": "registered",
            "dispute_state": "none",
            "created_at": now(),
        }
        db.parcels.update_one(
            {"parcel_number": sample_parcel["parcel_number"], "zone_id": sample_parcel["zone_id"]},
            {"$setOnInsert": sample_parcel},
            upsert=True,
        )
        sample_parcel_doc = db.parcels.find_one({"parcel_number": sample_parcel["parcel_number"], "zone_id": sample_parcel["zone_id"]})
        sample_application = {
            "application_id": sample["application_id"],
            "application_type": "ownership_transfer",
            "type": "ownership_transfer",
            "status": "survey_required",
            "priority": sample["priority"],
            "description": f"Survey sample application for parcel {sample_parcel_doc['parcel_number']}.",
            "workflow": {"current_state": "survey_required", "allowed_next": ["surveyed", "under_objection", "on_hold", "rejected"]},
            "parcel_ref": {
                "parcel_id": str(sample_parcel_doc["_id"]),
                "parcel_code": sample_parcel_doc["parcel_code"],
                "parcel_number": sample_parcel_doc["parcel_number"],
                "block_number": sample_parcel_doc["block_number"],
                "basin_number": sample_parcel_doc["basin_number"],
                "zone_id": sample_parcel_doc["zone_id"],
                "area_sqm": sample_parcel_doc.get("area_sqm"),
            },
            "applicant_ref": {"applicant_id": str(applicant_doc["_id"]), "full_name": applicant_doc["full_name"]},
            "required_documents": application["required_documents"],
            "documents": application["documents"],
            "assignment": {"assigned_surveyor": str(staff_doc["_id"]), "assigned_registrar": None},
            "objection": {"has_objection": False, "objection_ids": []},
            "internal": {"notes": [], "visible_registrar_notes": []},
            "timestamps": {"submitted_at": now(), "updated_at": now()},
            "created_at": now(),
            "updated_at": now(),
        }
        db.land_applications.update_one(
            {"application_id": sample_application["application_id"]},
            {"$setOnInsert": sample_application},
            upsert=True,
        )
        sample_application_doc = db.land_applications.find_one({"application_id": sample_application["application_id"]})
        sample_task = {
            "task_id": sample["task_id"],
            "application_id": str(sample_application_doc["_id"]),
            "application_number": sample_application_doc["application_id"],
            "parcel_id": str(sample_parcel_doc["_id"]),
            "parcel_ref": sample_application["parcel_ref"],
            "milestones": sample["milestones"],
            "status": sample["current_milestone"],
            "current_milestone": sample["current_milestone"],
            "assigned_surveyor": str(staff_doc["_id"]),
            "assigned_surveyor_id": str(staff_doc["_id"]),
            "priority": sample["priority"],
            "field_notes": [],
            "report_uploaded": False,
            "created_at": now(),
            "updated_at": now(),
        }
        db.survey_tasks.update_one(
            {"application_id": sample_task["application_id"]},
            {"$setOnInsert": sample_task},
            upsert=True,
        )
        db.performance_logs.update_one(
            {"application_id": str(sample_application_doc["_id"])},
            {"$setOnInsert": {"application_id": str(sample_application_doc["_id"]), "event_stream": [{"type": "seed_created", "at": now(), "by": "system"}]}},
            upsert=True,
        )

    db.performance_logs.update_one(
        {"application_id": str(application_doc["_id"])},
        {
            "$set": {
                "application_id": str(application_doc["_id"]),
                "event_stream": [{"type": "seed_created", "at": now(), "by": "system"}],
            }
        },
        upsert=True,
    )

    users = [
        {
            "username": "applicant1",
            "password_hash": hash_password("123456"),
            "role": "applicant",
            "linked_id": str(applicant_doc["_id"]),
            "full_name": applicant_doc["full_name"],
            "active": True,
            "created_at": now(),
            "last_login_at": None,
        },
        {
            "username": "staff1",
            "password_hash": hash_password("123456"),
            "role": "staff",
            "linked_id": str(registrar_doc["_id"]),
            "full_name": "Omar Al-Registrar",
            "active": True,
            "created_at": now(),
            "last_login_at": None,
        },
        {
            "username": "surveyor1",
            "password_hash": hash_password("123456"),
            "role": "surveyor",
            "linked_id": str(staff_doc["_id"]),
            "full_name": "Hassan Surveyor",
            "active": True,
            "created_at": now(),
            "last_login_at": None,
        },
    ]
    for user in users:
        db.users.update_one({"username": user["username"]}, {"$set": user}, upsert=True)

    return serialize_object_id(
        {
            "message": "Seed sample data inserted",
            "application_id": application["application_id"],
            "collections": db.list_collection_names(),
        }
    )


if __name__ == "__main__":
    print(seed_sample_data())
