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

# Local <link href>/<script src> tags inside imported HTML — attribute order and quote style vary.
_LINK_TAG_RE = re.compile(
    r"<link\b[^>]*?(?<![\w-])href\s*=\s*(?P<q>[\"']?)(?P<ref>[^\"'>\s]+)(?P=q)[^>]*>",
    re.IGNORECASE,
)
_SCRIPT_TAG_RE = re.compile(
    r"<script\b[^>]*?(?<![\w-])src\s*=\s*(?P<q>[\"']?)(?P<ref>[^\"'>\s]+)(?P=q)[^>]*>\s*</script>",
    re.IGNORECASE,
)


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


def _local_basename(ref: str) -> str:
    """Basename of a local href/src reference — query, hash and separators ignored."""
    return ref.split("?", 1)[0].split("#", 1)[0].replace("\\", "/").rsplit("/", 1)[-1].lower()


def _assemble_imported_html(files: list, name: str = "Imported App") -> tuple[str, list[str]]:
    """One self-contained HTML page from imported files: inline local css/js, or synthesize a page."""
    by_basename = {}
    for f in files:
        by_basename.setdefault(_local_basename(f["path"]), f)

    entry = by_basename.get("index.html") or next(
        (f for f in files if f["path"].lower().endswith((".html", ".htm"))), None
    )
    inlined: list[str] = []

    if not entry:
        # No HTML in the upload — build a minimal page around the css/js we do have.
        css_parts, js_parts = [], []
        for f in files:
            if "\x00" in f["content"]:
                continue  # binary-looking
            if f["path"].lower().endswith(".css"):
                css_parts.append(f["content"])
            elif f["path"].lower().endswith(".js"):
                js_parts.append(f["content"])
            else:
                continue
            if f["path"] not in inlined:
                inlined.append(f["path"])
        css = "\n\n".join(css_parts)
        js = "\n\n".join(js_parts)
        return (
            "<!DOCTYPE html>\n<html>\n<head>\n"
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f"<title>{name}</title>\n"
            f"<style>\n{css}\n</style>\n"
            "</head>\n<body>\n"
            f"<script>\n{js}\n</script>\n"
            "</body>\n</html>"
        ), inlined

    html = entry["content"]

    def _inline_css(match) -> str:
        target = by_basename.get(_local_basename(match.group("ref")))
        if not target or not target["path"].lower().endswith(".css"):
            return match.group(0)
        if target["path"] not in inlined:
            inlined.append(target["path"])
        return f"<style>\n{target['content']}\n</style>"

    def _inline_js(match) -> str:
        target = by_basename.get(_local_basename(match.group("ref")))
        if not target or not target["path"].lower().endswith(".js"):
            return match.group(0)
        if target["path"] not in inlined:
            inlined.append(target["path"])
        return f"<script>\n{target['content']}\n</script>"

    html = _LINK_TAG_RE.sub(_inline_css, html)
    html = _SCRIPT_TAG_RE.sub(_inline_js, html)
    if not html.strip():
        html = (
            "<!DOCTYPE html>\n<html>\n<head>\n"
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f"<title>{name}</title>\n"
            "</head>\n<body></body>\n</html>"
        )
    return html, inlined


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


@router.post("/import", status_code=201)
def import_project(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assemble uploaded files into one HTML page and create a ready project."""
    raw_name = body.get("name")
    if raw_name is not None and not isinstance(raw_name, str):
        raise HTTPException(status_code=422, detail="'name' must be a string")
    cleaned_name = "".join(ch for ch in (raw_name or "") if ord(ch) >= 32 and ord(ch) != 127).strip()
    name = cleaned_name[:160] or "Imported App"

    files = body.get("files")
    if not isinstance(files, list) or not files:
        raise HTTPException(status_code=422, detail="Please provide a non-empty 'files' list of {path, content} objects")
    if len(files) > 80:
        raise HTTPException(status_code=422, detail="Too many files — an import accepts at most 80 files")

    for i, f in enumerate(files):
        if not isinstance(f, dict):
            raise HTTPException(status_code=422, detail=f"files[{i}] must be an object with 'path' and 'content'")
        path = f.get("path")
        content = f.get("content")
        if not isinstance(path, str) or not path.strip():
            raise HTTPException(status_code=422, detail=f"files[{i}]: 'path' must be a non-empty string")
        if len(path) > 256:
            raise HTTPException(status_code=422, detail=f"files[{i}]: 'path' is too long (max 256 characters)")
        if not isinstance(content, str):
            raise HTTPException(status_code=422, detail=f"files[{i}]: 'content' must be a string")
        if len(content) > 400_000:
            raise HTTPException(status_code=422, detail=f"files[{i}] ('{path}') is too large — max 400,000 characters each")

    if sum(len(f["content"]) for f in files) > 2_000_000:
        raise HTTPException(status_code=422, detail="Import is too large — the combined file content must stay under 2,000,000 characters")

    html, _ = _assemble_imported_html(files, name=name)

    all_paths = [f["path"] for f in files]
    shown = all_paths[:12]
    project = Project(
        user_id=user.id,
        name=name,
        description=f"Imported {len(files)} file(s)",
        original_prompt="Imported existing files: " + ", ".join(shown) + ("…" if len(all_paths) > 12 else ""),
        html=html,
        status="ready",
        version=1,
        error=None,
    )
    db.add(project)
    db.flush()
    db.add(
        Message(
            project_id=project.id,
            role="assistant",
            content=(
                f"Imported {len(files)} file(s): {', '.join(all_paths[:8])}"
                + ("…" if len(all_paths) > 8 else "")
                + ". Your app is ready — preview it or ask me to change anything."
            ),
        )
    )
    db.add(ProjectVersion(project_id=project.id, version=1, html=html, label="Imported files"))
    db.commit()
    db.refresh(project)
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
