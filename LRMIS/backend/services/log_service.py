from services.workflow_service import now


def add_log(db, application_id, event_type, actor_type="system", actor_id=None, meta=None):
    event = {
        "type": event_type,
        "by": {"actor_type": actor_type, "actor_id": actor_id},
        "at": now(),
        "meta": meta or {},
    }
    db.performance_logs.update_one(
        {"application_id": application_id},
        {
            "$push": {"event_stream": event},
            "$setOnInsert": {
                "application_id": application_id,
                "computed_kpis": {
                    "processing_days": None,
                    "precheck_minutes": None,
                    "survey_delay_days": None,
                    "certificate_issued": False,
                },
            },
        },
        upsert=True,
    )


def add_notification(db, application, message):
    applicant_ref = application.get("applicant_ref", {})
    db.notifications.insert_one(
        {
            "recipient_type": "applicant",
            "recipient_id": applicant_ref.get("applicant_id"),
            "channel": "email",
            "to": applicant_ref.get("email", "nour@example.com"),
            "subject": "Application status changed",
            "message": message,
            "status": "stubbed",
            "created_at": now(),
        }
    )

