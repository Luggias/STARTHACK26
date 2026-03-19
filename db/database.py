from supabase import create_client, Client
from dotenv import load_dotenv
import os
import pathlib

# Ensure .env is loaded from the project root regardless of cwd
_project_root = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Lazy client initialization — avoids crash if env vars are missing at import time
_db: Client | None = None


def _get_db() -> Client:
    """Return the shared Supabase client, creating it on first use."""
    global _db
    if _db is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set in .env. "
                "See .env.example for the required format."
            )
        _db = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _db


# ── Helpers ───────────────────────────────────────────────────────────────────
def create(table: str, row: dict):
    """INSERT one row, return the executed result."""
    return _get_db().table(table).insert(row).execute()


def read(table: str, filters: dict | None = None, limit: int | None = None) -> list[dict]:
    """SELECT rows. filters = {"col": value, ...}"""
    q = _get_db().table(table).select("*")
    if filters:
        for col, val in filters.items():
            q = q.eq(col, val)
    if limit:
        q = q.limit(limit)
    return q.execute().data


def update(table: str, id, changes: dict):
    """UPDATE row by id, return the executed result."""
    return _get_db().table(table).update(changes).eq("id", id).execute()


def delete(table: str, id) -> None:
    """DELETE row by id."""
    _get_db().table(table).delete().eq("id", id).execute()


def upsert(table: str, row: dict, on_conflict: str = "id"):
    """INSERT or UPDATE row on conflict. Returns the executed result."""
    return _get_db().table(table).upsert(row, on_conflict=on_conflict).execute()
