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
)

from database import Base


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
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


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
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(32), primary_key=True, default=_uid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    # user | assistant
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class ProjectVersion(Base):
    __tablename__ = "project_versions"
    __table_args__ = (UniqueConstraint("project_id", "version"),)

    id = Column(String(32), primary_key=True, default=_uid)
    project_id = Column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    html = Column(Text, nullable=False)
    label = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
