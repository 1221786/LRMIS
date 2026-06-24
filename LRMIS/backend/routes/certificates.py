from fastapi import APIRouter, HTTPException

from database import db, serialize_doc

router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.get("/")
def list_certificates():
    return serialize_doc(list(db.certificates.find({}).sort("issued_at", -1)))


@router.get("/{certificate_id}")
def get_certificate(certificate_id: str):
    cert = db.certificates.find_one({"certificate_id": certificate_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    app = db.land_applications.find_one({"_id": cert["application_id"]})
    parcel = db.parcels.find_one({"_id": cert["parcel_id"]})
    cert["application"] = app
    cert["parcel"] = parcel
    return serialize_doc(cert)


@router.get("/{certificate_id}/verify")
def verify_certificate(certificate_id: str):
    cert = db.certificates.find_one({"certificate_id": certificate_id})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"certificate_id": certificate_id, "valid": True, "status": cert["status"]}

