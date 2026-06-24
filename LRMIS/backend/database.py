from pymongo import MongoClient
from pymongo.errors import OperationFailure

from config import DATABASE_NAME, MONGO_URI

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[DATABASE_NAME]


def connect_to_mongo():
    if "<db_password>" in MONGO_URI:
        raise RuntimeError("Replace <db_password> in .env with your MongoDB Atlas password")
    try:
        client.admin.command("ping")
    except OperationFailure as exc:
        raise RuntimeError("MongoDB authentication failed. Check Atlas username and password.") from exc
    print("MongoDB Connected Successfully")


def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        return {key: serialize_doc(value) for key, value in doc.items()}
    if hasattr(doc, "binary"):
        return str(doc)
    return doc

