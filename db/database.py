from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Single shared client — import this wherever you need DB access
db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Example usage ─────────────────────────────────────────────────────────────
# from db.database import db
#
# # Read
# result = db.table("your_table").select("*").execute()
#
# # Insert
# db.table("your_table").insert({"column": "value"}).execute()
#
# # Filter
# db.table("your_table").select("*").eq("id", 1).execute()
