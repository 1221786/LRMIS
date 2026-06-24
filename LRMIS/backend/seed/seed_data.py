from database import db, serialize_doc
from seed.create_indexes import create_indexes
from services.log_service import add_log
from services.workflow_service import allowed_next, now, required_documents


def seed():
    existing = set(db.list_collection_names())
    for name in [
        "applicants",
        "land_applications",
        "parcels",
        "application_documents",
        "objections",
        "staff_members",
        "survey_tasks",
        "survey_reports",
        "performance_logs",
        "certificates",
        "notifications",
    ]:
        if name not in existing:
            db.create_collection(name)

    create_indexes(db)

    applicant = {
        "full_name": "Nour Ahmad",
        "applicant_type": "citizen",
        "identity": {
            "national_id": "400000000",
            "registration_number": None,
            "verified": True,
            "verification_state": "verified",
            "verification_method": "otp_stub",
            "verified_at": now(),
        },
        "contacts": {"email": "nour@example.com", "phone": "+970599000000"},
        "address": {"city": "Ramallah", "neighborhood": "Al Tireh", "zone_id": "ZONE-RM-01"},
        "preferences": {"language": "ar", "preferred_contact": "email", "notifications": {"on_status_change": True, "on_missing_documents": True, "on_certificate_ready": True}},
        "privacy_settings": {"show_phone_to_staff": True, "show_email_to_staff": True},
        "linked_applications": [],
        "stats": {"total_applications": 0, "approved_applications": 0, "pending_applications": 0},
        "created_at": now(),
        "updated_at": now(),
    }
    db.applicants.update_one({"identity.national_id": "400000000"}, {"$set": applicant}, upsert=True)
    applicant = db.applicants.find_one({"identity.national_id": "400000000"})

    parcel = {
        "parcel_code": "RM-Z01-B12-P145",
        "parcel_number": "145",
        "block_number": "12",
        "basin_number": "3",
        "zone_id": "ZONE-RM-01",
        "current_owner_refs": [{"applicant_id": applicant["_id"], "share": "1/1"}],
        "area_sqm": 850.5,
        "land_use": "residential",
        "registration_status": "registered",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[35.2001, 31.9021], [35.2015, 31.9021], [35.2015, 31.9030], [35.2001, 31.9030], [35.2001, 31.9021]]],
        },
        "address_hint": "Ramallah - Al Tireh",
        "dispute_state": "none",
        "created_at": now(),
        "updated_at": now(),
    }
    db.parcels.update_one({"parcel_code": parcel["parcel_code"]}, {"$set": parcel}, upsert=True)
    parcel = db.parcels.find_one({"parcel_code": "RM-Z01-B12-P145"})

    staff_members = [
        {
            "staff_code": "SURV-RM-04",
            "name": "Survey Team A",
            "role": "surveyor",
            "department": "Cadastral Survey",
            "skills": ["boundary_survey", "parcel_subdivision", "gps_mapping"],
            "coverage": {"zone_ids": ["ZONE-RM-01", "ZONE-RM-02"]},
            "schedule": {"timezone": "Asia/Jerusalem", "shifts": [{"day": "Mon", "start": "08:00", "end": "16:00"}], "on_call": False},
            "workload": {"active_tasks": 0, "max_tasks": 10},
            "contacts": {"phone": "+970599111111", "email": "survey_a@example.com"},
            "active": True,
            "created_at": now(),
        },
        {
            "staff_code": "REG-RM-09",
            "name": "Registrar Huda",
            "role": "registrar",
            "department": "Legal Registration",
            "skills": ["legal_review", "certificate_issuance"],
            "coverage": {"zone_ids": ["ZONE-RM-01"]},
            "workload": {"active_tasks": 2, "max_tasks": 15},
            "contacts": {"phone": "+970599222222", "email": "registrar@example.com"},
            "active": True,
            "created_at": now(),
        },
    ]
    for staff in staff_members:
        db.staff_members.update_one({"staff_code": staff["staff_code"]}, {"$set": staff}, upsert=True)

    app_doc = {
        "application_id": "LRMIS-2026-0001",
        "application_type": "ownership_transfer",
        "status": "submitted",
        "priority": "normal",
        "applicant_ref": {"applicant_id": applicant["_id"], "full_name": applicant["full_name"], "applicant_type": "citizen", "email": "nour@example.com", "submitted_by_representative": False},
        "parcel_ref": {"parcel_id": parcel["_id"], "parcel_number": "145", "block_number": "12", "basin_number": "3", "zone_id": "ZONE-RM-01"},
        "description": "Ownership transfer application for parcel 145.",
        "tags": ["ownership_transfer"],
        "workflow": {"current_state": "submitted", "allowed_next": allowed_next("submitted"), "transition_rules_version": "v1.0"},
        "required_documents": required_documents(
            "ownership_transfer",
            [
                {"document_type": "ownership_deed", "status": "pending_review", "file_name": "deed.pdf", "file_url": "/uploads/deed.pdf"},
                {"document_type": "id_copy", "status": "pending_review", "file_name": "id.pdf", "file_url": "/uploads/id.pdf"},
                {"document_type": "parcel_map", "status": "pending_review", "file_name": "map.pdf", "file_url": "/uploads/map.pdf"},
            ],
        ),
        "timestamps": {"submitted_at": now(), "pre_checked_at": None, "survey_required_at": None, "surveyed_at": None, "legal_review_at": None, "approved_at": None, "certificate_issued_at": None, "closed_at": None, "updated_at": now()},
        "assignment": {"assigned_surveyor_id": None, "assigned_registrar_id": None, "assignment_policy": "zone+workload+availability"},
        "objection": {"has_objection": False, "objection_ids": []},
        "certificate": {"certificate_id": None, "status": "not_issued"},
        "internal": {"notes": [], "registrar_remarks": [], "visibility": "staff_only"},
        "survey_report_exists": False,
        "legal_review_completed": False,
        "idempotency_key": "seed-ownership-transfer",
    }
    db.land_applications.update_one({"application_id": "LRMIS-2026-0001"}, {"$set": app_doc}, upsert=True)
    app_doc = db.land_applications.find_one({"application_id": "LRMIS-2026-0001"})
    add_log(db, app_doc["_id"], "submitted", actor_type="applicant", actor_id=str(applicant["_id"]), meta={"seed": True})

    return {
        "message": "Seed data inserted",
        "applicant": applicant["full_name"],
        "application_id": app_doc["application_id"],
        "collections": db.list_collection_names(),
    }


if __name__ == "__main__":
    print(serialize_doc(seed()))
