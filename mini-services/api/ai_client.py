"""Client for the Z.AI brain service (mini-services/ai-service) + response parsing.

Reliability contract: the sandbox platform rotates /etc/.z-ai-config whenever
it pleases (boot writes a placeholder first; the real token can land minutes
later). A user build must NEVER die just because the credentials were mid-flight,
so call_ai retries patiently for minutes (it runs inside a background task the
user already sees as "building") and reports progress so the project row stays
fresh against the 5-minute stale-marker.
"""

import json
import re
import time

import httpx

from config import settings

META_RE = re.compile(r"<LOVIFY_META>\s*(\{.*?\})\s*</LOVIFY_META>", re.DOTALL)
HTML_RE = re.compile(r"<LOVIFY_HTML>\s*(<!DOCTYPE.*?)(?:</LOVIFY_HTML>)?\s*$", re.DOTALL | re.IGNORECASE)
FENCE_RE = re.compile(r"```(?:html)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)

# Substrings that mark a TRANSIENT brain failure worth retrying (the brain
# heals itself — it re-reads rotated Z.AI credentials between attempts).
TRANSIENT_MARKERS = (
    "x-token",
    "status 401",
    "status 403",
    "status 429",
    "status 5",
    "401",
    "403",
    "429",
    "unauthorized",
    "forbidden",
    "rate limit",
    "overloaded",
    "unreachable",
    "empty response",
    "configuration file",
    "timed out",
    "timeout",
    "temporary",
    "temporarily",
    "connection",
)

FRIENDLY_AUTH_ERROR = (
    "Lovify could not reach the Z.AI brain after several minutes of automatic retries. "
    "The platform is re-issuing credentials — press Retry (or send the request again) "
    "and it will go through."
)


class GenerationError(Exception):
    """Raised when the AI output is missing, invalid or truncated."""


class TransientGenerationError(GenerationError):
    """A brain/infrastructure blip that later attempts may survive."""


def _is_transient(error_text: str) -> bool:
    lowered = error_text.lower()
    return any(marker in lowered for marker in TRANSIENT_MARKERS)


def call_ai(
    mode: str,
    prompt: str,
    current_html: str | None = None,
    history: list | None = None,
    progress=None,
) -> str:
    """Call the Z.AI brain service and return the raw model output.

    Retries transient brain failures (credential rotation, blips) with a
    patient backoff — the whole schedule fits in ~4.5 minutes, far under the
    UI's stale-build window because `progress` keeps the project row touched.

    `progress` (if given) is called before every attempt so callers can bump
    `updated_at` and keep the build visibly alive.
    """
    payload = {"mode": mode, "prompt": prompt, "history": history or []}
    if current_html:
        payload["currentHtml"] = current_html

    # Patient schedule: survives a brain restart AND the platform's
    # credential-rotation window (observed up to a few minutes after boot).
    sleeps = (3, 6, 10, 15, 20, 25, 30, 30)  # 139s of waiting across 8 attempts

    last_text = "AI generation failed"
    for attempt in range(len(sleeps) + 1):
        if callable(progress):
            try:
                progress(attempt)
            except Exception:  # noqa: S110 — progress must never kill a build
                pass

        try:
            resp = httpx.post(
                f"{settings.ai_service_url}/generate",
                json=payload,
                timeout=httpx.Timeout(120.0, connect=10.0),
            )
        except httpx.HTTPError as exc:
            last_text = f"AI brain unreachable: {exc}"
        else:
            try:
                data = resp.json()
            except Exception as exc:
                last_text = "AI brain returned an invalid response"
                data = None
                if attempt < len(sleeps):
                    time.sleep(sleeps[attempt])
                    continue
                raise TransientGenerationError(last_text) from exc

            if resp.status_code == 200 and data.get("ok"):
                return str(data.get("raw", ""))

            last_text = str(data.get("error", "AI generation failed"))
            if not _is_transient(last_text):
                break  # permanent (e.g. truncated output) — surface it now

        if attempt < len(sleeps):
            time.sleep(sleeps[attempt])

    if _is_transient(last_text):
        # All retries burned on auth/infra blips — actionable message + the
        # transient subtype lets the caller schedule one more rescue round.
        raise TransientGenerationError(FRIENDLY_AUTH_ERROR)
    raise GenerationError(last_text)


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
