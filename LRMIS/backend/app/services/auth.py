import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import db, serialize_object_id

JWT_SECRET = os.getenv("JWT_SECRET", "lrmis-development-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))

bearer_scheme = HTTPBearer(auto_error=False)


def now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user: dict) -> str:
    payload = {
        "sub": str(user["_id"]),
        "username": user["username"],
        "role": user["role"],
        "linked_id": user["linked_id"],
        "exp": now() + timedelta(minutes=JWT_EXPIRE_MINUTES),
        "iat": now(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def public_user(user: dict) -> dict:
    clean = serialize_object_id(user)
    clean.pop("password_hash", None)
    return clean


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.get("active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return user


def require_roles(*roles: str):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role is not allowed")
        return user

    return dependency


def ensure_application_access(application: dict, user: dict) -> None:
    if user["role"] == "staff":
        return
    if user["role"] == "applicant":
        if application.get("applicant_ref", {}).get("applicant_id") == user["linked_id"]:
            return
    if user["role"] == "surveyor":
        task = db.survey_tasks.find_one(
            {
                "application_id": str(application["_id"]),
                "assigned_surveyor": user["linked_id"],
            }
        )
        if task:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access this resource")
