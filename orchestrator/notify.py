"""ntfy.sh fire-and-forget notifications."""
from __future__ import annotations

import secrets
import urllib.error
import urllib.request
from typing import Callable


def generate_topic(prefix: str = "pith-loop") -> str:
    # ponytail: secrets.token_hex beats uuid for unguessable short topic
    return f"{prefix}-{secrets.token_hex(16)}"


def notify(
    topic: str,
    title: str,
    message: str,
    *,
    base_url: str = "https://ntfy.sh",
    poster: Callable[[str, bytes, dict], None] | None = None,
) -> None:
    if not topic or "REPLACE" in topic:
        raise ValueError("ntfy topic not configured — run setup first")
    url = f"{base_url.rstrip('/')}/{topic}"
    body = message.encode("utf-8")
    headers = {"Title": title, "Content-Type": "text/plain; charset=utf-8"}

    def _default_post(u: str, data: bytes, hdrs: dict) -> None:
        req = urllib.request.Request(u, data=data, headers=hdrs, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp.read()
        except urllib.error.URLError:
            # fire-and-forget: log-free swallow for transport errors (caller may log)
            pass

    (poster or _default_post)(url, body, headers)


# Event helpers — no per-process-success helper by design (FR-012)
def notify_start(topic: str, remaining: int, current_group: str, **kw) -> None:
    notify(topic, "loop-eng start", f"remaining={remaining} group={current_group}", **kw)


def notify_flow_group_done(topic: str, group_id: str, summary: str, **kw) -> None:
    notify(topic, "loop-eng group done", f"{group_id}: {summary}", **kw)


def notify_blocked(topic: str, process_id: str, reason: str, **kw) -> None:
    notify(topic, "loop-eng blocked", f"{process_id}: {reason}", **kw)


def notify_exhaustion(topic: str, role: str, **kw) -> None:
    notify(topic, "loop-eng model exhaustion", f"role={role} entering backoff", **kw)


def notify_run_complete(topic: str, **kw) -> None:
    notify(topic, "loop-eng complete", "all processes terminal", **kw)


def notify_unhandled(topic: str, error: str, **kw) -> None:
    notify(topic, "loop-eng UNHANDLED", error[:500], **kw)
