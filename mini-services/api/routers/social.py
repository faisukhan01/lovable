"""Social router: likes, remix, public profiles, usage stats, account settings,
project duplicate / unpublish.

All new community features of Lovify live here. Powered by Z.AI backend.
"""

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import Like, Message, Project, ProjectVersion, User

router = APIRouter(tags=["social"])


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _handleify(raw: str) -> str:
    handle = re.sub(r"[^a-z0-9]+", "-", (raw or "").lower()).strip("-")
    handle = re.sub(r"-+", "-", handle)[:40]
    return handle or "builder"


def ensure_handle(db: Session, user: User) -> str:
    """Give every user a stable, unique public handle (idempotent)."""
    if user.handle:
        return user.handle
    base = _handleify(user.name or user.email.split("@")[0])
    handle = base
    suffix = 0
    while db.query(User).filter(User.handle == handle, User.id != user.id).first():
        suffix += 1
        handle = f"{base}-{suffix}"[:64]
    user.handle = handle
    db.commit()
    return handle


def _like_count(db: Session, project_id: str) -> int:
    return (
        db.query(func.count(Like.id))
        .filter(Like.project_id == project_id)
        .scalar()
        or 0
    )


def _app_card(db: Session, p: Project, handle: str | None, liked_ids: set[str] | None = None) -> dict:
    return {
        "slug": p.published_slug,
        "name": p.name,
        "description": p.description or "",
        "version": p.version,
        "views": p.views or 0,
        "likes": _like_count(db, p.id),
        "author": handle or "builder",
        "published_at": p.published_at.isoformat() if p.published_at else None,
        "liked": (liked_ids is not None) and (p.id in liked_ids),
    }


def _published_project(db: Session, slug: str) -> Project:
    project = (
        db.query(Project)
        .filter(Project.published_slug == slug, Project.html.isnot(None))
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Published app not found")
    return project


# --------------------------------------------------------------------------
# likes
# --------------------------------------------------------------------------

@router.post("/api/published/{slug}/like")
def toggle_like(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Like / unlike a published app. Returns the fresh state."""
    project = _published_project(db, slug)
    existing = (
        db.query(Like)
        .filter(Like.user_id == user.id, Like.project_id == project.id)
        .first()
    )
    if existing:
        db.delete(existing)
        liked = False
    else:
        db.add(Like(user_id=user.id, project_id=project.id))
        liked = True
    db.commit()
    return {"liked": liked, "likes": _like_count(db, project.id)}


@router.get("/api/me/likes")
def my_likes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apps the current user has liked."""
    rows = (
        db.query(Project, User.handle)
        .join(Like, Like.project_id == Project.id)
        .outerjoin(User, User.id == Project.user_id)
        .filter(Like.user_id == user.id, Project.published_slug.isnot(None))
        .order_by(desc(Like.created_at))
        .limit(50)
        .all()
    )
    return {
        "apps": [
            {
                "slug": p.published_slug,
                "name": p.name,
                "description": p.description or "",
                "views": p.views or 0,
                "likes": _like_count(db, p.id),
                "author": handle or "builder",
                "published_at": p.published_at.isoformat() if p.published_at else None,
                "liked": True,
            }
            for p, handle in rows
        ]
    }


# --------------------------------------------------------------------------
# remix — clone any published app into your workspace
# --------------------------------------------------------------------------

@router.post("/api/published/{slug}/remix", status_code=201)
def remix(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source = _published_project(db, slug)
    remix_project = Project(
        user_id=user.id,
        name=f"{source.name} (remix)"[:160],
        description=source.description or "",
        original_prompt=source.original_prompt or source.name,
        html=source.html,
        status="ready",
        version=1,
    )
    db.add(remix_project)
    db.flush()
    db.add(
        ProjectVersion(
            project_id=remix_project.id,
            version=1,
            html=source.html or "",
            label=f"Remixed from {source.name}",
        )
    )
    db.add(
        Message(
            project_id=remix_project.id,
            role="assistant",
            content=(
                f"This is a remix of {source.name} — an exact copy to start from. "
                "Tell me what you want to change and I will rebuild it."
            ),
        )
    )
    db.commit()
    db.refresh(remix_project)
    return {"id": remix_project.id, "name": remix_project.name, "status": remix_project.status}


# --------------------------------------------------------------------------
# public builder profiles  /u/<handle>
# --------------------------------------------------------------------------

@router.get("/api/u/{handle}")
def public_profile(handle: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.handle == handle).first()
    if not user:
        raise HTTPException(status_code=404, detail="Builder not found")

    rows = (
        db.query(Project)
        .filter(Project.user_id == user.id, Project.published_slug.isnot(None))
        .order_by(desc(Project.published_at))
        .limit(50)
        .all()
    )
    total_views = sum((p.views or 0) for p in rows)
    return {
        "handle": user.handle,
        "name": user.name or (user.email.split("@")[0] if user.email else "Builder"),
        "joined": user.created_at.isoformat() if user.created_at else None,
        "apps_published": len(rows),
        "total_views": total_views,
        "apps": [
            {
                "slug": p.published_slug,
                "name": p.name,
                "description": p.description or "",
                "views": p.views or 0,
                "likes": _like_count(db, p.id),
                "published_at": p.published_at.isoformat() if p.published_at else None,
            }
            for p in rows
        ],
    }


# --------------------------------------------------------------------------
# account settings + usage
# --------------------------------------------------------------------------

@router.patch("/api/me")
def update_me(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the display name; (re)issue the public handle if missing."""
    name = str(body.get("name", "")).strip()
    if name:
        user.name = name[:120]
    handle = ensure_handle(db, user)
    db.commit()
    return {
        "ok": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "handle": handle,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
    }


@router.get("/api/me/usage")
def my_usage(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Personal usage dashboard numbers."""
    project_ids = [
        row[0]
        for row in db.query(Project.id).filter(Project.user_id == user.id).all()
    ]
    projects = len(project_ids)
    published = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == user.id, Project.published_slug.isnot(None))
        .scalar()
        or 0
    )
    versions = (
        db.query(func.count(ProjectVersion.id))
        .filter(ProjectVersion.project_id.in_(project_ids or [""]))
        .scalar()
        or 0
    )
    messages = (
        db.query(func.count(Message.id))
        .filter(Message.project_id.in_(project_ids or [""]))
        .scalar()
        or 0
    )
    likes_received = (
        db.query(func.count(Like.id))
        .join(Project, Project.id == Like.project_id)
        .filter(Project.user_id == user.id)
        .scalar()
        or 0
    )
    views_received = (
        db.query(func.coalesce(func.sum(Project.views), 0))
        .filter(Project.user_id == user.id)
        .scalar()
        or 0
    )
    return {
        "projects": projects,
        "published": published,
        "versions": versions,
        "messages": messages,
        "likes_received": likes_received,
        "views_received": views_received,
    }


# --------------------------------------------------------------------------
# project duplicate + unpublish
# --------------------------------------------------------------------------

def _own_project(db: Session, project_id: str, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/api/projects/{project_id}/duplicate", status_code=201)
def duplicate_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source = _own_project(db, project_id, user)
    if not source.html:
        raise HTTPException(status_code=409, detail="Nothing to duplicate yet — wait for the first build.")

    copy = Project(
        user_id=user.id,
        name=f"{source.name} (copy)"[:160],
        description=source.description,
        original_prompt=source.original_prompt,
        html=source.html,
        status="ready",
        version=1,
    )
    db.add(copy)
    db.flush()
    db.add(
        ProjectVersion(
            project_id=copy.id, version=1, html=source.html or "", label="Duplicated"
        )
    )
    db.commit()
    db.refresh(copy)
    return {"id": copy.id, "name": copy.name, "status": copy.status, "version": copy.version}


@router.post("/api/projects/{project_id}/unpublish")
def unpublish_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    if not project.published_slug:
        raise HTTPException(status_code=409, detail="This app is not published")
    project.published_slug = None
    project.published_at = None
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
