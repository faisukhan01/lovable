"""Lovify database models: users, projects, messages, project versions."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    types,
)

from database import Base


class TZDateTime(types.TypeDecorator):
    """Timezone-safe DateTime that behaves identically on PostgreSQL and SQLite.

    SQLite drops tzinfo, which made `datetime.now(utc) - project.updated_at`
    crash with "can't subtract offset-naive and offset-aware datetimes".
    This decorator always stores naive-UTC and returns aware-UTC.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, _dialect):  # noqa: ANN001
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, _dialect):  # noqa: ANN001
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


def _uid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(32), primary_key=True, default=_uid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TZDateTime(), default=_now, nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(32), primary_key=True, default=_uid)
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(160), default="Untitled App", nullable=False)
    description = Column(Text, default="")
    original_prompt = Column(Text, nullable=False)
    html = Column(Text, nullable=True)
    # generating | ready | error
    status = Column(String(20), default="generating", nullable=False, index=True)
    error = Column(Text, nullable=True)
    version = Column(Integer, default=0, nullable=False)
    published_slug = Column(String(120), unique=True, nullable=True, index=True)
    published_at = Column(TZDateTime(), nullable=True)
    created_at = Column(TZDateTime(), default=_now, nullable=False)
    updated_at = Column(TZDateTime(), default=_now, nullable=False)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(32), primary_key=True, default=_uid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    # user | assistant
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TZDateTime(), default=_now, nullable=False)


class ProjectVersion(Base):
    __tablename__ = "project_versions"
    __table_args__ = (UniqueConstraint("project_id", "version"),)

    id = Column(String(32), primary_key=True, default=_uid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    html = Column(Text, nullable=False)
    label = Column(Text, default="")
    created_at = Column(TZDateTime(), default=_now, nullable=False)
