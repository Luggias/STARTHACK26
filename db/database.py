from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Single shared client — import this wherever you need DB access
db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Helpers ───────────────────────────────────────────────────────────────────
def create(table: str, row: dict) -> dict:
    #INSERT one row, return the inserted record
    #create("users", {"name": "Alice", "city": "Zurich"})
    return db.table(table).insert(row).execute().data[0]

def read(table: str, filters: dict | None = None, limit: int | None = None) -> list[dict]:
    #SELECT rows. filters = {"col": value, ...}
    #read("users", filters={"city": "Zurich"}, limit=10)
    q = db.table(table).select("*")
    if filters:
        for col, val in filters.items():
            q = q.eq(col, val)
    if limit:
        q = q.limit(limit)
    return q.execute().data

def update(table: str, id, changes: dict) -> dict:
    #UPDATE row by id, return the updated record.
    #update("users", 42, {"city": "Bern"})
    return db.table(table).update(changes).eq("id", id).execute().data[0]

def delete(table: str, id) -> None:
    #DELETE row by id
    #delete("users", 42)
    db.table(table).delete().eq("id", id).execute()