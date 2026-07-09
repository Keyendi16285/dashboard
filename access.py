"""Access-control enforcement (mirrors casetracker Phase 2).

This app authenticates via the shared Case Tracker JWT (get_current_user
returns a username string) and has no ORM models for users, so it looks access
data up in the shared case_management ``user`` / ``user_tools`` / ``user_scope``
tables by username using raw SQL.

Model: account = one access level (read<edit<create) + tools + scope
(state/county/class/case). Admins bypass; grant-by-default; TST admin-only;
archived accounts denied; service/anonymous callers are unrestricted non-admins.
"""
from typing import Optional
from datetime import datetime

from fastapi import HTTPException, status
from sqlmodel import Session
from sqlalchemy import and_, func, text

from database import engine
from models import CaseEntry

TOOL_NAME = "dashboard"

LEVELS = ("read", "edit", "create")
_RANK = {level: i for i, level in enumerate(LEVELS)}

_SCOPE_COLUMNS = {
    "state": CaseEntry.state,
    "county": CaseEntry.county,
    "class": CaseEntry.case_class,
}


def _audit(event_type, actor, target=None, reason=None, detail=None):
    """Best-effort security-audit write to the shared access_audit table."""
    try:
        with Session(engine) as s:
            s.execute(
                text("INSERT INTO access_audit (timestamp, event_type, actor, tool, target, reason, detail) "
                     "VALUES (:ts, :e, :a, :t, :tg, :r, :d)"),
                {"ts": datetime.utcnow(), "e": event_type, "a": actor, "t": TOOL_NAME,
                 "tg": target, "r": reason, "d": detail},
            )
            s.commit()
    except Exception:
        pass


def reject_if_archived(session, username: Optional[str]) -> None:
    """Deny an archived account even with an otherwise-valid token."""
    if not username:
        return
    try:
        row = session.execute(
            text('SELECT is_archived FROM "user" WHERE username = :u'),
            {"u": username},
        ).first()
    except Exception:
        return
    if row and bool(row[0]):
        _audit("ACCESS_DENIED", username, reason="archived")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been archived.",
        )


class AccessContext:
    def __init__(self, is_admin, is_service, level, tools, scope_rows, actor=None):
        self.is_admin = is_admin
        self.is_service = is_service
        self.actor = actor
        self.level = level if level in _RANK else "read"
        self._tools = set(tools or [])
        self._scope = list(scope_rows or [])

    @property
    def can_edit(self) -> bool:
        return self.is_admin or self.is_service or _RANK[self.level] >= _RANK["edit"]

    @property
    def can_create(self) -> bool:
        return self.is_admin or self.is_service or _RANK[self.level] >= _RANK["create"]

    def _deny(self, reason, message, detail=None):
        _audit("ACCESS_DENIED", self.actor, reason=reason, detail=detail)
        raise HTTPException(status.HTTP_403_FORBIDDEN, message)

    def require_edit(self):
        if not self.can_edit:
            self._deny("read_only", "Your access level is read-only.")

    def require_create(self):
        if not self.can_create:
            self._deny("no_create", "You do not have permission to create records.")

    def scope_clause(self):
        if self.is_admin or self.is_service or not self._scope:
            return None
        by_dim: dict = {}
        for dim, val in self._scope:
            by_dim.setdefault(dim, []).append(val)
        clauses = []
        for dim, vals in by_dim.items():
            if dim == "case":
                ids = [int(v) for v in vals if str(v).strip().isdigit()]
                if ids:
                    clauses.append(CaseEntry.id.in_(ids))
                continue
            col = _SCOPE_COLUMNS.get(dim)
            if col is None:
                continue
            normed = [str(v).strip().upper() for v in vals]
            clauses.append(func.upper(func.trim(func.coalesce(col, ""))).in_(normed))
        return and_(*clauses) if clauses else None

    def filter_cases(self, statement):
        """Apply TST-admin-only + scope to a statement selecting/joining CaseEntry."""
        if not self.is_admin:
            statement = statement.where(
                func.upper(func.trim(func.coalesce(CaseEntry.case_class, ""))) != "TST"
            )
        clause = self.scope_clause()
        if clause is not None:
            statement = statement.where(clause)
        return statement


def load_access(session, username: Optional[str]) -> AccessContext:
    """Resolve tools + scope for the current account and enforce the tool gate."""
    if not username:
        return AccessContext(False, True, "read", [], [])
    row = session.execute(
        text('SELECT id, is_admin, is_archived, access_level FROM "user" WHERE username = :u'),
        {"u": username},
    ).first()
    if row is None:
        return AccessContext(False, True, "read", [], [], actor=username)
    user_id, is_admin, is_archived, access_level = row[0], bool(row[1]), bool(row[2]), row[3]
    if is_archived:
        _audit("ACCESS_DENIED", username, reason="archived")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been archived.")
    if is_admin:
        return AccessContext(True, False, access_level or "read", [], [], actor=username)

    tools = [r[0] for r in session.execute(
        text("SELECT tool FROM user_tools WHERE user_id = :id"), {"id": user_id}
    ).all()]
    if tools and TOOL_NAME not in tools:
        _audit("ACCESS_DENIED", username, reason="tool_gate")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to the Dashboard.")

    scope_rows = [(r[0], r[1]) for r in session.execute(
        text("SELECT dimension, value FROM user_scope WHERE user_id = :id"), {"id": user_id}
    ).all()]
    return AccessContext(False, False, access_level or "read", tools, scope_rows, actor=username)
