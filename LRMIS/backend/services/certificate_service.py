from services.log_service import add_log
from services.workflow_service import now


def next_certificate_id(db):
    count = db.certificates.count_documents({}) + 1
    return f"CERT-2026-{count:04d}"


def issue_certificate(db, application, issued_by="registrar_09"):
    if application["status"] != "approved":
        raise ValueError("Certificate can only be issued for approved applications")

    certificate_id = next_certificate_id(db)
    certificate = {
        "certificate_id": certificate_id,
        "application_id": application["_id"],
        "parcel_id": application["parcel_ref"]["parcel_id"],
        "certificate_type": "ownership_certificate",
        "status": "issued",
        "issued_to": {
            "applicant_id": application["applicant_ref"]["applicant_id"],
            "full_name": application["applicant_ref"]["full_name"],
        },
        "issued_at": now(),
        "issued_by": issued_by,
        "verification": {
            "qr_code_url": f"/certificates/{certificate_id}/verify",
            "digital_signature_stub": f"signed_hash_{certificate_id}",
        },
    }
    result = db.certificates.insert_one(certificate)
    db.land_applications.update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "status": "certificate_issued",
                "workflow.current_state": "certificate_issued",
                "workflow.allowed_next": ["closed"],
                "certificate.certificate_id": result.inserted_id,
                "certificate.status": "issued",
                "timestamps.certificate_issued_at": now(),
                "timestamps.updated_at": now(),
            }
        },
    )
    db.performance_logs.update_one({"application_id": application["_id"]}, {"$set": {"computed_kpis.certificate_issued": True}})
    add_log(db, application["_id"], "certificate_issued", actor_type="registrar", actor_id=issued_by)
    certificate["_id"] = result.inserted_id
    return certificate

