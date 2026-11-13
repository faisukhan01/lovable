"""Public router: published apps, explore gallery, platform stats. No auth required.

Explore supports search (q) and sorting (newest | liked | viewed), and every
app card carries social proof: views, likes and the author's public handle.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Like, Project, User

router = APIRouter(prefix="/api", tags=["public"])


def _like_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(Like.project_id, func.count(Like.id))
        .group_by(Like.project_id)
        .all()
    )
    return {pid: count for pid, count in rows}


@router.get("/published/{slug}")
def get_published(slug: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.published_slug == slug).first()
    if not project or not project.html:
        raise HTTPException(status_code=404, detail="Published app not found")

    # count the visit
    project.views = (project.views or 0) + 1
    db.commit()

    author = db.query(User).filter(User.id == project.user_id).first()
    likes = db.query(func.count(Like.id)).filter(Like.project_id == project.id).scalar() or 0
    return {
        "slug": slug,
        "name": project.name,
        "description": project.description or "",
        "html": project.html,
        "published_at": project.published_at.isoformat() if project.published_at else None,
        "views": project.views or 0,
        "likes": likes,
        "author": (author.handle if author and author.handle else "builder"),
        "author_name": (author.name if author else None) or "Builder",
    }


@router.get("/explore")
def explore(
    q: str = "",
    sort: str = "newest",
    limit: int = 24,
    with_html: int = 0,
    db: Session = Depends(get_db),
):
    """Public gallery of published apps — searchable, sortable, social."""
    base = (
        db.query(Project, User.handle)
        .outerjoin(User, User.id == Project.user_id)
        .filter(Project.published_slug.isnot(None))
    )

    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        base = base.filter(or_(Project.name.ilike(like), Project.description.ilike(like)))

    rows = base.order_by(desc(Project.published_at)).limit(120).all()

    counts = _like_counts(db)
    apps = []
    for p, handle in rows:
        item = {
            "slug": p.published_slug,
            "name": p.name,
            "description": p.description or "",
            "version": p.version,
            "views": p.views or 0,
            "likes": counts.get(p.id, 0),
            "author": handle or "builder",
            "published_at": p.published_at.isoformat() if p.published_at else None,
        }
        if with_html:
            item["html"] = p.html
        apps.append(item)

    if sort == "liked":
        apps.sort(key=lambda a: (-a["likes"], -a["views"]))
    elif sort == "viewed":
        apps.sort(key=lambda a: (-a["views"], -a["likes"]))
    # "newest" keeps the published_at order

    return {"apps": apps[: max(1, min(limit, 48))]}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "builders": db.query(func.count(User.id)).scalar() or 0,
        "apps": db.query(func.count(Project.id)).scalar() or 0,
        "published": db.query(func.count(Project.id)).filter(Project.published_slug.isnot(None)).scalar() or 0,
        "likes": db.query(func.count(Like.id)).scalar() or 0,
        "views": db.query(func.coalesce(func.sum(Project.views), 0)).scalar() or 0,
    }
