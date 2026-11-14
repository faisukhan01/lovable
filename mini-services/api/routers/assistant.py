"""Assistant router: AI conversations that do NOT rebuild the app.

- POST /api/assistant/chat   — standalone Lovify Chat (chat-only mode)
- POST /api/projects/{id}/ask — Ask mode: questions about YOUR app, no code edits
- POST /api/projects/{id}/plan — Plan mode: an implementation plan before building

All three are synchronous Z.AI calls via the ai-service brain (port 8001).
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user
from models import Message, Project, User

router = APIRouter(tags=["assistant"])

CHAT_TIMEOUT = httpx.Timeout(180.0, connect=10.0)

ASSISTANT_SYSTEM = """You are Lovify Chat, the built-in AI companion of the Lovify app-building platform, powered by Z.AI.
You help users brainstorm product ideas, plan features, write copy, compare tech approaches, and answer questions about the Lovify platform itself.
Style: sharp, warm, practical. Prefer short paragraphs and bullet lists. Use markdown-ish formatting sparingly (**bold**, - bullets, `code`).
When a user describes an app idea worth building, end with a single nudge like: "Ready? Hit Build on the dashboard and I'll make it real."
Never claim to be Claude, GPT or any other model — you are Lovify Chat on Z.AI."""

ASK_SYSTEM = """You are Lovify Ask — the read-only expert on the user's app, powered by Z.AI.
You can SEE the app's current HTML/JS/CSS and its conversation history, and you ANSWER QUESTIONS about it:
how something works, where a bug might come from, how a feature is implemented, ideas for improvements.
STRICT RULE: you never output code changes and never claim to have modified anything. Explain, advise, point at specifics (component names, functions, lines of behavior).
Style: concise, friendly, concrete. Reference the actual app when answering."""

PLAN_SYSTEM = """You are Lovify Plan — the architect step of the Lovify builder, powered by Z.AI.
The user gives a change request for their existing app. You DO NOT write code and you DO NOT change the app.
Instead output a crisp implementation plan:
1. **What will change** — 2-4 bullets referencing current UI/behavior.
2. **Steps** — numbered, each one concrete (e.g. "add a filter state to the toolbar, wire it to the card list").
3. **Trade-offs / risks** — 1-2 bullets max.
End with: "Send 'Build it' and I'll make this real."
Keep it under 200 words. No code blocks longer than one line."""


class ChatIn(BaseModel):
    messages: list[dict] = Field(default_factory=list)


class AskIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


def _brain_chat(system: str, history: list[dict], prompt: str) -> str:
    """Call the ai-service /chat endpoint and return the raw reply."""
    try:
        resp = httpx.post(
            f"{settings.ai_service_url}/chat",
            json={"system": system, "prompt": prompt, "history": history[-10:]},
            timeout=CHAT_TIMEOUT,
        )
        data = resp.json()
        raw = str(data.get("raw", "")).strip()
        if resp.status_code != 200 or not data.get("ok") or not raw:
            raise ValueError(data.get("error", "empty response"))
        return raw[:6000]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="The AI brain is busy. Try again in a moment.")


@router.post("/api/assistant/chat")
def assistant_chat(
    body: ChatIn,
    user: User = Depends(get_current_user),
):
    """Chat-only mode: talk to Lovify Chat without any project attached."""
    clean: list[dict] = []
    for m in body.messages[-12:]:
        role = "assistant" if m.get("role") == "assistant" else "user"
        content = str(m.get("content", "")).strip()
        if content:
            clean.append({"role": role, "content": content[:4000]})

    if not clean:
        raise HTTPException(status_code=422, detail="Say something first")

    last = clean.pop()
    reply = _brain_chat(ASSISTANT_SYSTEM, clean, last["content"])
    return {"reply": reply}


def _own_project(db: Session, project_id: str, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _project_history(db: Session, project_id: str, limit: int = 6) -> list[dict]:
    rows = (
        db.query(Message)
        .filter(Message.project_id == project_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {"role": m.role, "content": m.content[:1500]}
        for m in reversed(rows)
    ]


@router.post("/api/projects/{project_id}/ask")
def project_ask(
    project_id: str,
    body: AskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ask mode — get answers about your app without changing any code."""
    project = _own_project(db, project_id, user)
    message = body.message.strip()

    db.add(Message(project_id=project.id, role="user", content=f"(ask) {message}"))
    db.commit()

    history = _project_history(db, project.id)[:-1]
    context = (
        f"The user's app (single-file HTML app, current version v{project.version}) "
        f"is named \"{project.name}\". Current code:\n\n"
        f"<APP_CODE>\n{(project.html or '')[:60000]}\n</APP_CODE>\n\n"
        f"Question: {message}"
    )
    reply = _brain_chat(ASK_SYSTEM, history, context)

    db.add(Message(project_id=project.id, role="assistant", content=f"(ask) {reply[:2000]}"))
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"reply": reply, "mode": "ask"}


@router.post("/api/projects/{project_id}/plan")
def project_plan(
    project_id: str,
    body: AskIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Plan mode — get an implementation plan without changing the app."""
    project = _own_project(db, project_id, user)
    if project.status == "generating":
        raise HTTPException(status_code=409, detail="The AI is still working on this app. Wait for it to finish.")
    message = body.message.strip()

    db.add(Message(project_id=project.id, role="user", content=f"(plan) {message}"))
    db.commit()

    history = _project_history(db, project.id)[:-1]
    context = (
        f"App: \"{project.name}\" (v{project.version}). Current code summary: "
        f"{(project.description or 'single-file HTML app')}. "
        f"The code is {(len(project.html or '') // 1024)}KB of HTML/CSS/JS.\n\n"
        f"Requested change: {message}"
    )
    reply = _brain_chat(PLAN_SYSTEM, history, context)

    db.add(Message(project_id=project.id, role="assistant", content=f"(plan) {reply[:2000]}"))
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"reply": reply, "mode": "plan"}
