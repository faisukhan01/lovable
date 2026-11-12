"""Pydantic request/response schemas."""

from pydantic import BaseModel, Field, field_validator


class SignupIn(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=72)
    name: str | None = None

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        import re

        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None
    created_at: str | None = None


class AuthOut(BaseModel):
    token: str
    user: UserOut


class CreateProjectIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=8000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class RestoreIn(BaseModel):
    version: int


class PublishIn(BaseModel):
    slug: str | None = None
