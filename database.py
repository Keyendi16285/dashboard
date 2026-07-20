from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy import text
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Pull from .env if available, otherwise use the Returnalyzer default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:%21casemanagement%212%23@db:5432/case_management")

engine = create_engine(DATABASE_URL, echo=True)


def ensure_schema_safeguards():
    """Best-effort additive columns the dashboard depends on but does not own.

    The shared ``user`` table (owned by Case Tracker) needs a ``token_version``
    column for token-revocation checks. Databases created before that column was
    added lack it, and SQLModel's ``create_all`` never adds columns to existing
    tables — so the auth layer would error on every request. This adds it if
    missing. Idempotent (ADD COLUMN IF NOT EXISTS) and fail-open (never blocks
    startup); Postgres-only, since that syntax is Postgres-specific.
    """
    if not DATABASE_URL.startswith("postgresql"):
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(
                'ALTER TABLE "user" ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0'
            ))
    except Exception as e:
        # Never let a safeguard crash startup (e.g. table absent or no privilege).
        print(f"[schema-safeguard] token_version ensure skipped: {e}")


def create_db_and_tables():
    """Initializes tables if they don't exist."""
    SQLModel.metadata.create_all(engine)
    ensure_schema_safeguards()

def get_session():
    """Dependency for FastAPI routes to handle DB transactions[cite: 5]."""
    with Session(engine) as session:
        yield session