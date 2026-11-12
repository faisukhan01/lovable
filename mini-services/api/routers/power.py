"""Extra power endpoints: AI prompt enhancement, fork, rename, explore."""

import re
import secrets
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user
from models import Message, Project, ProjectVersion, User

router = APIRouter(tags=["power"])

ENHANCER_SYSTEM = """You are Lovify's Prompt Enhancer, powered by Z.AI. Users type a rough one-line app idea; you rewrite it into a rich, specific app brief that an AI builder can execute brilliantly.

Rules:
- Keep it under 120 words, one paragraph.
- Sharpen the product idea: name the core features (3-6), the screens, and the interactions.
- Specify the visual direction (palette mood, typography vibe, layout feel) without mentioning hex codes.
- Mention data persistence or interactivity details when relevant.
- NEVER mention that you are an AI, never greet, never ask questions. Output ONLY the enhanced prompt text, nothing else."""


class EnhanceIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)


class RenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)


@router.post("/api/enhance-prompt")
def enhance_prompt(body: EnhanceIn, user: User = Depends(get_current_user)):
    """Rewrite a rough idea into a detailed app brief using Z.AI."""
    try:
        resp = httpx.post(
            f"{settings.ai_service_url}/chat",
            json={
                "prompt": body.prompt,
                "system": ENHANCER_SYSTEM,
            },
            timeout=httpx.Timeout(90.0, connect=10.0),
        )
        data = resp.json()
        enhanced = str(data.get("raw", "")).strip().strip('"')
        if resp.status_code != 200 or not data.get("ok") or not enhanced:
            raise ValueError(data.get("error", "empty response"))
    except Exception:
        raise HTTPException(status_code=502, detail="The prompt enhancer is busy. Try again in a moment.")
    return {"prompt": enhanced[:4000]}


def _own_project(db: Session, project_id: str, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/api/projects/{project_id}")
def rename_project(
    project_id: str,
    body: RenameIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _own_project(db, project_id, user)
    project.name = body.name.strip() or project.name
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "name": project.name}


@router.post("/api/projects/{project_id}/fork", status_code=201)
def fork_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clone one of your projects (including its current HTML) as a new one."""
    source = _own_project(db, project_id, user)
    if not source.html:
        raise HTTPException(status_code=409, detail="Nothing to fork yet — wait for the first build.")

    fork = Project(
        user_id=user.id,
        name=f"{source.name} (fork)"[:160],
        description=source.description,
        original_prompt=source.original_prompt,
        html=source.html,
        status="ready",
        version=1,
    )
    db.add(fork)
    db.flush()
    db.add(
        ProjectVersion(
            project_id=fork.id,
            version=1,
            html=source.html,
            label=f"Forked from {source.name}",
        )
    )
    db.add(
        Message(
            project_id=fork.id,
            role="assistant",
            content=f"This is a fork of {source.name}. It starts as an exact copy — tell me what you want to change.",
        )
    )
    db.commit()
    db.refresh(fork)
    return {
        "id": fork.id,
        "name": fork.name,
        "status": fork.status,
        "version": fork.version,
    }
