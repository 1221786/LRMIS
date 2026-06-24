from fastapi import APIRouter
from app.core.database import db
from datetime import datetime

router = APIRouter()

logs = db["performance_logs"]

# 🟢 GET ALL LOGS
@router.get("/logs")
def get_logs():

    data = list(logs.find({}, {"_id": 0}))

    return {
        "count": len(data),
        "logs": data
    }


# 🟢 ADD LOG
def add_log(event: str, ref_id: str):

    logs.insert_one({
        "event": event,
        "ref_id": ref_id,
        "time": datetime.utcnow()
    })