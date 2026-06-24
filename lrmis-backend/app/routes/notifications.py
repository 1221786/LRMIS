from fastapi import APIRouter

router = APIRouter()

# 🟢 SEND NOTIFICATION (SIMULATION)
@router.post("/notify")
def notify(user: str, message: str):

    return {
        "status": "sent (stub)",
        "user": user,
        "message": message
    }