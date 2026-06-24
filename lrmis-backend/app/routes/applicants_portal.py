from fastapi import APIRouter
from app.core.database import db
from datetime import datetime

router = APIRouter()

collection = db["applicants"]

# 🟢 Create Profile
@router.post("/applicants")
def create_applicant(data: dict):

    applicant = {
        "name": data.get("name"),
        "national_id": data.get("national_id"),
        "phone": data.get("phone"),
        "email": data.get("email"),

        # 🧠 required by doctor
        "type": data.get("type", "citizen"),

        "status": "unverified",

        "created_at": datetime.utcnow(),

        "settings": {
            "language": "en",
            "notifications": True
        }
    }

    collection.insert_one(applicant)

    return {"message": "Applicant created"}


# 🟢 Get Applicant Profile
@router.get("/applicants/{national_id}")
def get_applicant(national_id: str):

    return collection.find_one(
        {"national_id": national_id},
        {"_id": 0}
    )


# 🟢 Update Verification
@router.patch("/applicants/{national_id}/verify")
def verify(national_id: str):

    collection.update_one(
        {"national_id": national_id},
        {"$set": {"status": "verified"}}
    )

    return {"message": "verified"}