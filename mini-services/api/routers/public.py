"""Public router: published apps, explore gallery, platform stats. No auth required."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
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


@router.get("/explore")
def explore(with_html: int = 0, db: Session = Depends(get_db)):
    """Public gallery of the latest published apps."""
    rows = (
        db.query(Project)
        .filter(Project.published_slug.isnot(None))
        .order_by(desc(Project.published_at))
        .limit(24)
        .all()
    )
    apps = []
    for p in rows:
        item = {
            "slug": p.published_slug,
            "name": p.name,
            "description": p.description or "",
            "version": p.version,
            "published_at": p.published_at.isoformat() if p.published_at else None,
        }
        if with_html:
            item["html"] = p.html
        apps.append(item)
    return {"apps": apps}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "builders": db.query(func.count(User.id)).scalar() or 0,
        "apps": db.query(func.count(Project.id)).scalar() or 0,
        "published": db.query(func.count(Project.id)).filter(Project.published_slug.isnot(None)).scalar() or 0,
    }
