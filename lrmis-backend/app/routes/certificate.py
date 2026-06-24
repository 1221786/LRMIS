from fastapi import APIRouter
from app.core.database import db
from datetime import datetime
import uuid

router = APIRouter()

certificates = db["certificates"]
applications = db["land_applications"]

# 🟢 ISSUE CERTIFICATE
@router.post("/applications/{application_id}/issue-certificate")
def issue_certificate(application_id: str):

    cert_id = str(uuid.uuid4())

    cert = {
        "certificate_id": cert_id,
        "application_id": application_id,
        "issued_at": datetime.utcnow(),
        "status": "valid"
    }

    certificates.insert_one(cert)

    applications.update_one(
        {"application_id": application_id},
        {"$set": {"status": "certificate_issued"}}
    )

    return {
        "message": "Certificate issued",
        "certificate_id": cert_id
    }