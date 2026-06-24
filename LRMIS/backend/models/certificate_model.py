from pydantic import BaseModel


class RegistrarReviewRequest(BaseModel):
    decision: str
    note: str = "All legal documents verified"
    registrar_id: str = "registrar_09"

