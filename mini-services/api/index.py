"""Lovify API — FastAPI main backend.

Runs on port 8000. The Next.js frontend reaches it through the gateway:
    fetch('/api/...?XTransformPort=8000')

Database: Neon PostgreSQL (SQLAlchemy). AI brain: Z.AI via ai-service:8001.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import Base, SessionLocal, engine
from generation import fail_stale_generations
from models import Project, ProjectVersion, User  # noqa: F401 — register models
from routers import auth, projects, public


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    fail_stale_generations()
    yield


app = FastAPI(
    title="Lovify API",
    description="The main backend of Lovify — an AI app-builder platform powered by Z.AI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(public.router)


@app.get("/api/health")
def health():
    db_ok = False
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "service": "lovify-api", "database": "ok" if db_ok else "down"}
