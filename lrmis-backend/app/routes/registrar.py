from fastapi import APIRouter, HTTPException
from app.core.database import db
from datetime import datetime
import uuid

router = APIRouter()

applications = db["land_applications"]
certificates = db["certificates"]
logs = db["performance_logs"]

# 🟢 GET APPLICATIONS FOR LEGAL REVIEW
@router.get("/registrar/review")
def get_for_review():

    data = list(applications.find(
        {"status": "legal_review"},
        {"_id": 0}
    ))

    return {
        "count": len(data),
        "applications": data
    }


# 🟢 LEGAL DECISION (APPROVE / REJECT)
@router.patch("/registrar/{application_id}/decision")
def registrar_decision(application_id: str, decision: str, notes: str = ""):

    app = applications.find_one({"application_id": application_id})

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if decision not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid decision")

    # update application
    applications.update_one(
        {"application_id": application_id},
        {
            "$set": {
                "status": decision,
                "registrar_notes": notes,
                "decision_time": datetime.utcnow()
            }
        }
    )

    # log
    logs.insert_one({
        "event": "registrar_decision",
        "application_id": application_id,
        "decision": decision,
        "time": datetime.utcnow()
    })

    return {"message": f"Application {decision}"}


# 🟢 ISSUE CERTIFICATE (ONLY IF APPROVED)
@router.post("/registrar/{application_id}/certificate")
def issue_certificate(application_id: str):

    app = applications.find_one({"application_id": application_id})

    if not app:
        raise HTTPException(status_code=404, detail="Not found")

    if app["status"] != "approved":
        raise HTTPException(status_code=400, detail="Must be approved first")

    cert_id = str(uuid.uuid4())

    certificate = {
        "certificate_id": cert_id,
        "application_id": application_id,
        "issued_at": datetime.utcnow(),
        "owner": app["applicant"]["name"],
        "parcel": app.get("parcel_number"),
        "zone": app.get("zone"),
        "qr_stub": f"QR-{cert_id[:8]}"
    }

    certificates.insert_one(certificate)

    # update application
    applications.update_one(
        {"application_id": application_id},
        {"$set": {"status": "certificate_issued"}}
    )

    logs.insert_one({
        "event": "certificate_issued",
        "application_id": application_id,
        "certificate_id": cert_id,
        "time": datetime.utcnow()
    })

    return {
        "message": "Certificate issued",
        "certificate_id": cert_id
    }


# 🟢 GET CERTIFICATES
@router.get("/certificates")
def get_certificates():

    data = list(certificates.find({}, {"_id": 0}))

    return {
        "count": len(data),
        "certificates": data
    }