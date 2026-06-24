from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import connect_to_mongo
from routes.analytics import router as analytics_router
from routes.applicants import router as applicants_router
from routes.applications import router as applications_router
from routes.certificates import router as certificates_router
from routes.staff import router as staff_router
from routes.survey import router as survey_router
from seed.create_indexes import create_indexes
from seed.seed_data import seed
from database import db

app = FastAPI(
    title="LRMIS - Land Registration Management Information System",
    description="FastAPI + MongoDB backend for land registration workflow, survey, certificates, maps, and analytics.",
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
def startup():
    connect_to_mongo()
    create_indexes(db)


@app.get("/")
def home():
    return {"message": "LRMIS API is running", "docs": "/docs"}


@app.post("/seed")
def seed_database():
    return seed()


app.include_router(applicants_router)
app.include_router(applications_router)
app.include_router(staff_router)
app.include_router(survey_router)
app.include_router(certificates_router)
app.include_router(analytics_router)
