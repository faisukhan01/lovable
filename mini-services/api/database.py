"""SQLAlchemy engine + session factory for the Neon PostgreSQL database."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings

# SQLAlchemy 2.x defaults to psycopg (v3) for `postgresql://` URLs; we ship
# psycopg2, so force the driver explicitly.
raw_url = settings.database_url
if raw_url.startswith("postgresql://"):
    raw_url = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)

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

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
