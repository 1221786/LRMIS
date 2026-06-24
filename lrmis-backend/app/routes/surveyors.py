from fastapi import APIRouter
from app.core.database import db

router = APIRouter()

collection = db["surveyors"]

# ➕ Create Surveyor
@router.post("/surveyors")
def create_surveyor(surveyor: dict):

    surveyor.setdefault("status", "available")
    surveyor.setdefault("workload", 0)

    collection.insert_one(surveyor)

    return {
        "message": "Surveyor created successfully"
    }


# 📄 Get Surveyors
@router.get("/surveyors")
def get_surveyors():

    data = list(collection.find({}, {"_id": 0}))

    return {
        "count": len(data),
        "data": data
    }


# 🔄 Update Surveyor Status
@router.put("/surveyors/{name}/status")
def update_surveyor_status(name: str, status: str):

    if status not in ["available", "busy"]:
        return {"error": "Invalid status"}

    result = collection.update_one(
        {"name": name},
        {"$set": {"status": status}}
    )

    if result.matched_count == 0:
        return {"error": "Surveyor not found"}

    return {"message": "Updated successfully"}