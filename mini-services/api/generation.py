"""Background AI generation pipeline (runs in FastAPI threadpool)."""

import threading
import time
from datetime import datetime, timedelta, timezone

from ai_client import (
    GenerationError,
    TransientGenerationError,
    call_ai,
    parse_lovify,
)
from database import SessionLocal
from models import Message, Project, ProjectVersion

STALE_AFTER = timedelta(minutes=5)

# One rescue round after the first patient round failed on a transient
# (credentials mid-rotation, brain restarting). Between rounds we wait a
# cooldown, touching the project row so the stale-marker never fires.
RESCUE_COOLDOWN_SECONDS = 45


def _touch(project_id: str) -> None:
    """Bump updated_at so polling/stale logic knows the build is alive."""
    try:
        with SessionLocal() as db:
            project = db.get(Project, project_id)
            if project and project.status == "generating":
                project.updated_at = datetime.now(timezone.utc)
                db.commit()
    except Exception:  # noqa: S110 — keep-alive must never kill a build
        pass


def _sleep_with_touch(project_id: str, seconds: int) -> None:
    for _ in range(max(1, seconds // 5)):
        time.sleep(min(5, seconds))
        seconds -= 5
        _touch(project_id)
        if seconds <= 0:
            break


def run_generation(project_id: str, mode: str, user_prompt: str) -> None:
    """Generate (mode='create') or edit (mode='edit') an app via Z.AI.

    Runs as a FastAPI BackgroundTask — own DB session, never touches the
    request-scoped one. On success: bumps version, stores HTML + version row
    + assistant message. On failure: flags the project with a readable error.

    Transient brain failures (credential rotation right after a sandbox boot,
    the #1 cause of "every build fails") get ONE extra full rescue round after
    a cooldown — call_ai itself already retries patiently for minutes.
    """
    try:
        _generate_once(project_id, mode, user_prompt)
    except TransientGenerationError:
        # Rescue round: the platform may still be rotating credentials.
        try:
            _sleep_with_touch(project_id, RESCUE_COOLDOWN_SECONDS)
            _generate_once(project_id, mode, user_prompt)
        except GenerationError as exc:
            _flag_error(project_id, str(exc))
        except Exception as exc:  # noqa: BLE001
            _flag_error(project_id, f"Unexpected error: {exc}")
    except GenerationError as exc:
        _flag_error(project_id, str(exc))
    except Exception as exc:  # noqa: BLE001 — never let a background task explode
        _flag_error(project_id, f"Unexpected error: {exc}")


def _generate_once(project_id: str, mode: str, user_prompt: str) -> None:
    """One full generate-or-edit round. Raises GenerationError on failure."""
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

    # 2. Ask the Z.AI brain (long call, outside any DB session).
    #    `progress` keeps the project row touched so the 5-minute stale
    #    markers in get_project / fail_stale_generations never kill a
    #    healthy-but-slow build while credentials rotate.
    raw = call_ai(
        mode,
        user_prompt,
        current_html=current_html,
        history=history_payload,
        progress=lambda _attempt: _touch(project_id),
    )
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


# In-process guard so a failed project is auto-resurrected at most once
# per window — no retry storms from polling.
_resurrect_at: dict[str, float] = {}
RESURRECT_WINDOW_SECONDS = 300
TRANSIENT_ERROR_MARKERS = (
    "re-issuing credentials",
    "unreachable",
    "timed out",
    "timeout",
    "invalid response",
    "empty response",
    "status 4",
    "status 5",
    "re-authenticating",
)


def resurrect_failed_generations() -> None:
    """Auto-retry recent builds that died to a transient infrastructure blip.

    The classic case: the user hits Build right after a sandbox cold boot,
    the platform's Z.AI credentials are still mid-rotation, and even the
    patient retry budget is not enough (or uvicorn restarted mid-build).
    Polling endpoints call this, so the failed build quietly re-queues
    itself and completes without the user doing anything.
    """
    now = time.time()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    with SessionLocal() as db:
        candidates = (
            db.query(Project)
            .filter(Project.status == "error", Project.updated_at >= cutoff)
            .all()
        )
        for project in candidates:
            error_text = (project.error or "").lower()
            if not any(marker in error_text for marker in TRANSIENT_ERROR_MARKERS):
                continue
            last = _resurrect_at.get(project.id, 0)
            if now - last < RESURRECT_WINDOW_SECONDS:
                continue
            _resurrect_at[project.id] = now
            last_user = (
                db.query(Message)
                .filter(Message.project_id == project.id, Message.role == "user")
                .order_by(Message.created_at.desc())
                .first()
            )
            if not last_user:
                continue
            mode = "edit" if project.html else "create"
            project.status = "generating"
            project.error = None
            project.updated_at = datetime.now(timezone.utc)
            db.commit()
            thread = threading.Thread(
                target=run_generation,
                args=(project.id, mode, last_user.content),
                daemon=True,
            )
            thread.start()
