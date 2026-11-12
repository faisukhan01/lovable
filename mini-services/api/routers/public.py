"""Public router: published apps + platform stats. No auth required."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Project, User

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/published/{slug}")
def get_published(slug: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.published_slug == slug).first()
    if not project or not project.html:
        raise HTTPException(status_code=404, detail="Published app not found")
    return {
        "slug": slug,
        "name": project.name,
        "description": project.description or "",
        "html": project.html,
        "published_at": project.published_at.isoformat() if project.published_at else None,
    }


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "builders": db.query(func.count(User.id)).scalar() or 0,
        "apps": db.query(func.count(Project.id)).scalar() or 0,
        "published": db.query(func.count(Project.id)).filter(Project.published_slug.isnot(None)).scalar() or 0,
    }
