"""SQLAlchemy engine + session factory for the Lovify database.

Primary target: Neon PostgreSQL (set DATABASE_URL in mini-services/api/.env).
Fallback: local SQLite (db/lovify.db) so the platform runs out of the box
even before a Postgres URL is configured — zero user action required.
"""

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent  # /home/z/my-project

raw_url = settings.database_url.strip()

IS_SQLITE = not raw_url  # no DATABASE_URL configured -> local SQLite

if IS_SQLITE:
    db_dir = PROJECT_ROOT / "db"
    db_dir.mkdir(parents=True, exist_ok=True)
    raw_url = f"sqlite:///{db_dir / 'lovify.db'}"
elif raw_url.startswith("postgresql://"):
    # SQLAlchemy 2.x defaults to psycopg (v3) for `postgresql://` URLs; we ship
    # psycopg2, so force the driver explicitly.
    raw_url = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)

if IS_SQLITE:
    engine = create_engine(raw_url, pool_pre_ping=True, connect_args={"check_same_thread": False})
else:
    # Neon uses PgBouncer (transaction pooling) on the -pooler host:
    # keep the pool small, pre-ping to survive idle disconnects.
    engine = create_engine(
        raw_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=280,
        connect_args={"connect_timeout": 15},
    )


if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
