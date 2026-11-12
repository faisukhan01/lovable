"""Shared FastAPI dependencies: DB session + current user auth."""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from security import decode_access_token


def get_current_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User:
    unauth = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )
    if not authorization or not authorization.startswith("Bearer "):
        raise unauth
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_access_token(token)
    if not user_id:
        raise unauth
    user = db.get(User, user_id)
    if not user:
        raise unauth
    return user
