"""Client for the Z.AI brain service (mini-services/ai-service) + response parsing."""

import json
import re

import httpx

from config import settings

META_RE = re.compile(r"<LOVIFY_META>\s*(\{.*?\})\s*</LOVIFY_META>", re.DOTALL)
HTML_RE = re.compile(r"<LOVIFY_HTML>\s*(<!DOCTYPE.*?)(?:</LOVIFY_HTML>)?\s*$", re.DOTALL | re.IGNORECASE)
FENCE_RE = re.compile(r"```(?:html)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


class GenerationError(Exception):
    """Raised when the AI output is missing, invalid or truncated."""


def call_ai(mode: str, prompt: str, current_html: str | None = None, history: list | None = None) -> str:
    """Call the Z.AI brain service and return the raw model output."""
    payload = {"mode": mode, "prompt": prompt, "history": history or []}
    if current_html:
        payload["currentHtml"] = current_html
    try:
        resp = httpx.post(
            f"{settings.ai_service_url}/generate",
            json=payload,
            timeout=httpx.Timeout(300.0, connect=10.0),
        )
    except httpx.HTTPError as exc:
        raise GenerationError(f"AI brain unreachable: {exc}") from exc

    try:
        data = resp.json()
    except Exception as exc:
        raise GenerationError("AI brain returned an invalid response") from exc

    if resp.status_code != 200 or not data.get("ok"):
        raise GenerationError(str(data.get("error", "AI generation failed")))
    return str(data.get("raw", ""))


def parse_lovify(raw: str) -> tuple[dict, str]:
    """Extract (meta, html) from the model output. Raises GenerationError on failure."""
    meta: dict = {"name": "", "description": "", "summary": ""}

    m = META_RE.search(raw)
    if m:
        try:
            parsed = json.loads(m.group(1))
            if isinstance(parsed, dict):
                for key in ("name", "description", "summary"):
                    if isinstance(parsed.get(key), str) and parsed[key].strip():
                        meta[key] = parsed[key].strip()
        except Exception:
            pass

    html = ""
    h = HTML_RE.search(raw)
    if h:
        html = h.group(1).strip()
    else:
        # Fallback 1: markdown fenced block containing a document
        for fence in FENCE_RE.finditer(raw):
            body = fence.group(1).strip()
            if body.lower().lstrip().startswith(("<!doctype", "<html")):
                html = body
                break
        # Fallback 2: raw document somewhere in the text
        if not html:
            lowered = raw.lower()
            idx = lowered.find("<!doctype html")
            if idx == -1:
                idx = lowered.find("<html")
            if idx != -1:
                html = raw[idx:].strip()

    if html:
        html = html.split("</LOVIFY_HTML>")[0].strip()
        if html.startswith("```"):
            html = re.sub(r"^```[a-zA-Z]*\s*", "", html)
            html = re.sub(r"\s*```$", "", html)
        html = html.strip()

    if not html:
        raise GenerationError("The AI response did not contain an app. Please try again.")

    if not re.search(r"</html>\s*$", html, re.IGNORECASE):
        raise GenerationError(
            "The generated app was too large and got truncated. Try a more focused request, or ask for a simpler version."
        )

    if not meta["name"]:
        title = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
        meta["name"] = (title.group(1).strip()[:80] if title else "Untitled App")

    return meta, html
