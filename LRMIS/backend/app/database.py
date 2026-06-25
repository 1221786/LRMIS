import os
from pathlib import Path
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "lrmis_db")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[DATABASE_NAME]

COLLECTIONS = {
    "land_applications": db.land_applications,
    "applicants": db.applicants,
    "parcels": db.parcels,
    "staff_members": db.staff_members,
    "survey_tasks": db.survey_tasks,
    "survey_reports": db.survey_reports,
    "certificates": db.certificates,
    "performance_logs": db.performance_logs,
    "generated_reports": db.generated_reports,
    "application_notes": db.application_notes,
    "users": db.users,
}


def connect_to_mongo() -> None:
    client.admin.command("ping")
    print("MongoDB Connected Successfully")


def serialize_object_id(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [serialize_object_id(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_object_id(item) for key, item in value.items()}
    return value
