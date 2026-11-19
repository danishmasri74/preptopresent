import pytest
from fastapi.testclient import TestClient

from app.jobs import UnknownJobKindError, dispatch, registered_kinds
from app.main import app


def test_health_reports_ok_and_job_kinds() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "ping" in body["job_kinds"]


def test_ping_job_echoes_message() -> None:
    assert dispatch("ping", {"message": "hello"}) == {"pong": True, "echo": "hello"}


def test_unknown_job_kind_raises() -> None:
    with pytest.raises(UnknownJobKindError):
        dispatch("does-not-exist", {})


def test_registered_kinds_sorted() -> None:
    kinds = registered_kinds()
    assert kinds == sorted(kinds)
