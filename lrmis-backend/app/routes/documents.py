from fastapi import APIRouter
from app.core.database import db
from datetime import datetime

router = APIRouter()

docs = db["application_documents"]

# 🟢 UPLOAD DOCUMENT
@router.post("/applications/{application_id}/documents")
def upload_document(application_id: str, doc: dict):

    data = {
        "application_id": application_id,
        "type": doc.get("type"),
        "file_url": doc.get("file_url"),
        "status": "pending",
        "uploaded_at": datetime.utcnow()
    }

    docs.insert_one(data)

    return {"message": "Document uploaded"}