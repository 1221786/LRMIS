import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import OperationFailure

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("MONGO_DATABASE", "lrmis")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[DATABASE_NAME]


def connect_to_mongo():
    try:
        client.admin.command("ping")
        print("✅ MongoDB Connected Successfully")
    except OperationFailure as exc:
        raise RuntimeError("MongoDB authentication failed") from exc