"""T06 notify tests."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from orchestrator.notify import generate_topic, notify, notify_blocked


def test_generate_topic_unguessable():
    a, b = generate_topic(), generate_topic()
    assert a.startswith("pith-loop-")
    assert a != b
    assert len(a) > 20


def test_notify_posts(captured=None):
    posts = []

    def poster(url, data, headers):
        posts.append((url, data.decode("utf-8"), headers))

    notify("pith-loop-abc", "t", "hello", poster=poster)
    assert posts[0][0].endswith("/pith-loop-abc")
    assert posts[0][1] == "hello"
    assert posts[0][2]["Title"] == "t"


def test_reject_placeholder_topic():
    try:
        notify("pith-loop-REPLACE_AT_SETUP", "t", "m", poster=lambda *a: None)
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_blocked_helper():
    posts = []
    notify_blocked("pith-loop-x", "proc-1", "regression", poster=lambda u, d, h: posts.append(d.decode()))
    assert "proc-1" in posts[0]
    assert "regression" in posts[0]


if __name__ == "__main__":
    test_generate_topic_unguessable()
    test_notify_posts()
    test_reject_placeholder_topic()
    test_blocked_helper()
    print("T06 OK")
