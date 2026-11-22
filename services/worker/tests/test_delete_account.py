from typing import Any
from uuid import uuid4

import pytest

from app.context import JobContext
from app.jobs import dispatch


class FakeResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class FakeConn:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.queries: list[tuple[str, Any]] = []

    def execute(self, sql: str, params: Any = None) -> FakeResult:
        self.queries.append((sql, params))
        return FakeResult(self.rows)


class FakeBucket:
    def __init__(self, name: str, log: list[tuple[str, list[str]]]) -> None:
        self.name, self.log = name, log

    def remove(self, paths: list[str]) -> None:
        self.log.append((self.name, paths))


class FakeAdmin:
    def __init__(self, error: Exception | None = None) -> None:
        self.deleted: list[str] = []
        self.error = error

    def delete_user(self, uid: str) -> None:
        if self.error:
            raise self.error
        self.deleted.append(uid)


class FakeSupabase:
    def __init__(self, admin: FakeAdmin) -> None:
        self.removed: list[tuple[str, list[str]]] = []
        self.storage = self
        self.auth = type("Auth", (), {"admin": admin})()

    def from_(self, bucket: str) -> FakeBucket:
        return FakeBucket(bucket, self.removed)


def test_removes_files_then_user() -> None:
    uid = uuid4()
    rows = [
        {"bucket_id": "decks", "name": f"{uid}/p1/d1.pdf"},
        {"bucket_id": "slide-images", "name": f"{uid}/p1/d1/001.png"},
        {"bucket_id": "slide-images", "name": f"{uid}/p1/d1/002.png"},
    ]
    conn, admin = FakeConn(rows), FakeAdmin()
    sb = FakeSupabase(admin)

    result = dispatch("delete_account", {"user_id": str(uid)}, JobContext(conn=conn, supabase=sb))

    assert result == {"files_removed": 3}
    assert sb.removed == [
        ("decks", [f"{uid}/p1/d1.pdf"]),
        ("slide-images", [f"{uid}/p1/d1/001.png", f"{uid}/p1/d1/002.png"]),
    ]
    assert admin.deleted == [str(uid)]
    # Only the user's own folder is listed.
    assert conn.queries[0][1][1] == f"{uid}/%"


def test_retry_after_user_already_gone_succeeds() -> None:
    conn = FakeConn([])
    sb = FakeSupabase(FakeAdmin(error=RuntimeError("User not found")))
    result = dispatch(
        "delete_account", {"user_id": str(uuid4())}, JobContext(conn=conn, supabase=sb)
    )
    assert result == {"files_removed": 0}


def test_other_auth_errors_are_retried() -> None:
    sb = FakeSupabase(FakeAdmin(error=RuntimeError("connection reset")))
    with pytest.raises(RuntimeError, match="connection reset"):
        dispatch(
            "delete_account", {"user_id": str(uuid4())}, JobContext(conn=FakeConn([]), supabase=sb)
        )


def test_rejects_missing_user_id() -> None:
    with pytest.raises(ValueError):
        dispatch("delete_account", {}, JobContext(conn=FakeConn([]), supabase=object()))
