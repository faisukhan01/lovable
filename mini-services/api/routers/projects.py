"""Projects router: CRUD, chat iteration, version history, publishing."""

import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from generation import fail_stale_generations, run_generation
from models import Message, Project, ProjectVersion, User

router = APIRouter(prefix="/api/projects", tags=["projects"])

STALE_AFTER = timedelta(minutes=5)


def _own_project(db: Session, project_id: str, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _summary(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description or "",
        "status": p.status,
        "error": p.error,
        "version": p.version or 0,
        "published_slug": p.published_slug,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _detail(db: Session, p: Project) -> dict:
    messages = (
        db.query(Message)
        .filter(Message.project_id == p.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    versions = (
        db.query(ProjectVersion)
        .filter(ProjectVersion.project_id == p.id)
        .order_by(ProjectVersion.version.desc())
        .all()
    )
    data = _summary(p)
    data.update(
        {
            "html": p.html,
            "original_prompt": p.original_prompt,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ],
            "versions": [
                {
                    "id": v.id,
                    "version": v.version,
                    "label": v.label,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                }
                for v in versions
            ],
        }
    )
    return data


@router.get("")
def list_projects(
    with_html: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fail_stale_generations()
    projects = (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    out = []
    for p in projects:
        item = _summary(p)
        if with_html:
            item["html"] = p.html
        out.append(item)
    return {"projects": out}


@router.post("", status_code=201)
def create_project(
    body: dict,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prompt = str(body.get("prompt", "")).strip()
    if len(prompt) < 3:
        raise HTTPException(status_code=422, detail="Please describe your app (at least 3 characters)")

    project = Project(user_id=user.id, original_prompt=prompt, status="generating")
    db.add(project)
    db.flush()
    db.add(Message(project_id=project.id, role="user", content=prompt))
    db.commit()
    db.refresh(project)

    background.add_task(run_generation, project.id, "create", prompt)
    return _detail(db, project)


@router.get("/{project_id}")
def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    # Auto-heal stuck generations (e.g. server restarted mid-task)
    if project.status == "generating" and project.updated_at:
        age = datetime.now(timezone.utc) - project.updated_at
        if age > STALE_AFTER:
            project.status = "error"
            project.error = "Generation timed out. Please send your request again."
            db.commit()
    return _detail(db, project)


@router.delete("/{project_id}")
def delete_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    db.query(Message).filter(Message.project_id == project.id).delete()
    db.query(ProjectVersion).filter(ProjectVersion.project_id == project.id).delete()
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/{project_id}/chat")
def chat(
    project_id: str,
    body: dict,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    if project.status == "generating":
        raise HTTPException(status_code=409, detail="The AI is still working on this app. Wait for it to finish.")

    message = str(body.get("message", "")).strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    db.add(Message(project_id=project.id, role="user", content=message))
    project.status = "generating"
    project.error = None
    project.updated_at = datetime.now(timezone.utc)
    db.commit()

    background.add_task(run_generation, project.id, "edit", message)
    return {"ok": True, "status": "generating"}


@router.post("/{project_id}/restore")
def restore_version(
    project_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    try:
        version_no = int(body.get("version"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid version")

    version = (
        db.query(ProjectVersion)
        .filter(ProjectVersion.project_id == project.id, ProjectVersion.version == version_no)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    project.version = (project.version or 0) + 1
    project.html = version.html
    project.status = "ready"
    project.error = None
    project.updated_at = datetime.now(timezone.utc)
    db.add(
        ProjectVersion(
            project_id=project.id,
            version=project.version,
            html=version.html,
            label=f"Restored v{version_no}",
        )
    )
    db.add(
        Message(
            project_id=project.id,
            role="assistant",
            content=f"Restored the app to version {version_no}.",
        )
    )
    db.commit()
    return _detail(db, project)


@router.post("/{project_id}/publish")
def publish(
    project_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    if project.status != "ready" or not project.html:
        raise HTTPException(status_code=409, detail="The app is not ready to publish yet")

    if project.published_slug:
        return {"slug": project.published_slug, "url": f"/p/{project.published_slug}"}

    base = re.sub(r"[^a-z0-9]+", "-", (project.name or "app").lower()).strip("-")[:40] or "app"
    slug = f"{base}-{secrets.token_hex(3)}"
    while db.query(Project).filter(Project.published_slug == slug).first():
        slug = f"{base}-{secrets.token_hex(3)}"

    project.published_slug = slug
    project.published_at = datetime.now(timezone.utc)
    db.commit()
    return {"slug": slug, "url": f"/p/{slug}"}


@router.get("/{project_id}/code")
def get_code(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    return {"html": project.html or "", "version": project.version}


@router.get("/{project_id}/versions/{version_no}")
def get_version_html(
    project_id: str,
    version_no: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stored HTML of one version — powers the diff viewer."""
    project = _own_project(db, project_id, user)
    version = (
        db.query(ProjectVersion)
        .filter(ProjectVersion.project_id == project.id, ProjectVersion.version == version_no)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return {
        "version": version.version,
        "label": version.label,
        "html": version.html,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }
