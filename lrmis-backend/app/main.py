from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import connect_to_mongo
from app.routes.applicants import router as applicants_router
from app.routes.applicants_portal import router as applicants_portal_router
from app.routes.applications import router as applications_router
from app.routes.survey_tasks import router as survey_tasks_router
from app.routes.surveyors import router as surveyors_router

app = FastAPI(title="LRMIS Backend")

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


@app.get("/")
def home():
    return {"message": "LRMIS running"}


app.include_router(applicants_router)
app.include_router(applicants_portal_router)
app.include_router(applications_router)
app.include_router(survey_tasks_router)
app.include_router(surveyors_router)
