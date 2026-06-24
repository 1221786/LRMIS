from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_to_mongo, db
from app.routers.analytics import router as analytics_router
from app.routers.applicants import router as applicants_router
from app.routers.applications import router as applications_router
from app.routers.auth import router as auth_router
from app.routers.operations import router as operations_router
from app.routers.survey import router as survey_router
from app.services.indexes import create_indexes

app = FastAPI(
    title="LRMIS - Land Registration Management Information System",
    description="Government land registration workflow backend.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    connect_to_mongo()
    create_indexes(db)


@app.get("/")
def health_check():
    return {"message": "LRMIS backend is running"}


app.include_router(applications_router)
app.include_router(applicants_router)
app.include_router(survey_router)
app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(operations_router)
