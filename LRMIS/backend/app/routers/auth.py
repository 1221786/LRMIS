from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from app.database import db
from app.services.auth import create_access_token, get_current_user, now, public_user, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginInput(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginInput):
    user = db.users.find_one({"username": payload.username})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.get("active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now()}})
    token = create_access_token(user)
    return {
        "access_token": token,
        "role": user["role"],
        "user_id": str(user["_id"]),
        "full_name": user["full_name"],
        "linked_id": user["linked_id"],
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}
