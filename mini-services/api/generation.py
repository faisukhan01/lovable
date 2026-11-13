"""Background AI generation pipeline (runs in FastAPI threadpool)."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ai_client import GenerationError, call_ai, parse_lovify
from database import SessionLocal
from models import Message, Project, ProjectVersion

STALE_AFTER = timedelta(minutes=5)


def run_generation(project_id: str, mode: str, user_prompt: str) -> None:
    """Generate (mode='create') or edit (mode='edit') an app via Z.AI.

    Runs as a FastAPI BackgroundTask — own DB session, never touches the
    request-scoped one. On success: bumps version, stores HTML + version row
    + assistant message. On failure: flags the project with a readable error.
    """
    try:
        # 1. Snapshot conversation context
        with SessionLocal() as db:
            project: Project | None = db.get(Project, project_id)
            if project is None:
                return
            history = (
                db.query(Message)
                .filter(Message.project_id == project_id)
                .order_by(Message.created_at.asc())
                .all()
            )
            # Exclude the message that was just written for this very request
            history = history[:-1] if history else []
            history_payload = [
                {"role": m.role, "content": m.content[:1500]} for m in history[-8:]
            ]
            current_html = project.html if mode == "edit" else None

        # 2. Ask the Z.AI brain (long call, outside any DB session)
        raw = call_ai(mode, user_prompt, current_html=current_html, history=history_payload)
        meta, html = parse_lovify(raw)

        # 3. Persist the result
        with SessionLocal() as db:
            project = db.get(Project, project_id)
            if project is None:
                return
            project.html = html
            project.version = (project.version or 0) + 1
            project.status = "ready"
            project.error = None
            if mode == "create" or project.name in (None, "", "Untitled App"):
                project.name = meta["name"][:160] or project.name
            if meta["description"]:
                project.description = meta["description"][:400]
            db.add(
                ProjectVersion(
                    project_id=project_id,
                    version=project.version,
                    html=html,
                    label=meta["summary"][:500],
                )
            )
            db.add(
                Message(
                    project_id=project_id,
                    role="assistant",
                    content=meta["summary"][:2000] or "App updated.",
                )
            )
            project.updated_at = datetime.now(timezone.utc)
            db.commit()
    except GenerationError as exc:
        _flag_error(project_id, str(exc))
    except Exception as exc:  # noqa: BLE001 — never let a background task explode
        _flag_error(project_id, f"Unexpected error: {exc}")


def _flag_error(project_id: str, message: str) -> None:
    try:
        with SessionLocal() as db:
            project = db.get(Project, project_id)
            if project:
                project.status = "error"
                project.error = message[:1000]
                project.updated_at = datetime.now(timezone.utc)
                db.commit()
    except Exception:  # noqa: S110 — best effort
        pass


def fail_stale_generations() -> None:
    """Mark projects stuck in 'generating' (e.g. after a server restart) as failed."""
    cutoff = datetime.now(timezone.utc) - STALE_AFTER
    with SessionLocal() as db:
        stale = (
            db.query(Project)
            .filter(Project.status == "generating", Project.updated_at < cutoff)
            .all()
        )
        for project in stale:
            project.status = "error"
            project.error = "Generation timed out. Please send your request again."
            project.updated_at = datetime.now(timezone.utc)
        if stale:
            db.commit()
