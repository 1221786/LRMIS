from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.applicants import router as applicants_router
from app.routes.applicants_portal import router as applicants_portal_router

app.include_router(applicants_portal_router)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(applicants_router)

@app.get("/")
def home():
    return {"message": "LRMIS running"}