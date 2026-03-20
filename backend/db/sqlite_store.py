"""SQLite persistent data layer for guest users, battle records, and strategies.

DB file: backend/data/game.db (auto-created on first use).
"""

import json
import sqlite3
import pathlib
import threading

_DB_PATH = pathlib.Path(__file__).resolve().parent.parent / "data" / "game.db"
_local = threading.local()


def _conn() -> sqlite3.Connection:
    """Return a thread-local connection with WAL mode."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        _local.conn = conn
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    c = _conn()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS guest_users (
            username TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            iq INTEGER DEFAULT 0,
            highscore REAL DEFAULT -999.0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS guest_battles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT NOT NULL,
            opponent_name TEXT NOT NULL,
            strategy_name TEXT,
            player_return REAL,
            opponent_return REAL,
            won INTEGER,
            is_pvp INTEGER,
            player_allocation TEXT,
            opponent_allocation TEXT,
            scenario_key TEXT,
            played_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS guest_strategies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            name TEXT NOT NULL,
            allocation TEXT NOT NULL,
            selected_assets TEXT,
            scenario_key TEXT,
            result TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    c.commit()

    # -- Migrations for existing DBs --
    cols = {r[1] for r in c.execute("PRAGMA table_info(guest_users)").fetchall()}
    if "best_return" in cols and "highscore" not in cols:
        c.execute("ALTER TABLE guest_users RENAME COLUMN best_return TO highscore")
        c.commit()
    if "highscore" not in cols and "best_return" not in cols:
        c.execute("ALTER TABLE guest_users ADD COLUMN highscore REAL DEFAULT -999.0")
        c.commit()

    bcols = {r[1] for r in c.execute("PRAGMA table_info(guest_battles)").fetchall()}
    for col, dtype in [("player_allocation", "TEXT"), ("opponent_allocation", "TEXT"), ("scenario_key", "TEXT")]:
        if col not in bcols:
            c.execute(f"ALTER TABLE guest_battles ADD COLUMN {col} {dtype}")
    c.commit()


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def get_user(username: str) -> dict | None:
    row = _conn().execute(
        "SELECT * FROM guest_users WHERE username = ?", (username.lower(),)
    ).fetchone()
    return dict(row) if row else None


def create_user(username: str, display_name: str, password_hash: str) -> dict:
    c = _conn()
    c.execute(
        "INSERT INTO guest_users (username, display_name, password_hash) VALUES (?, ?, ?)",
        (username.lower(), display_name, password_hash),
    )
    c.commit()
    return get_user(username)  # type: ignore[return-value]


def update_user_stats(username: str, iq: int, highscore: float) -> None:
    c = _conn()
    c.execute(
        "UPDATE guest_users SET iq = ?, highscore = ? WHERE username = ?",
        (iq, highscore, username.lower()),
    )
    c.commit()


# ---------------------------------------------------------------------------
# Battles
# ---------------------------------------------------------------------------

def save_battle(
    player_name: str,
    opponent_name: str,
    strategy_name: str,
    player_return: float,
    opponent_return: float,
    won: bool,
    is_pvp: bool,
    player_allocation: dict | None = None,
    opponent_allocation: dict | None = None,
    scenario_key: str | None = None,
) -> dict:
    c = _conn()
    cur = c.execute(
        """INSERT INTO guest_battles
           (player_name, opponent_name, strategy_name, player_return, opponent_return, won, is_pvp,
            player_allocation, opponent_allocation, scenario_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            player_name, opponent_name, strategy_name,
            player_return, opponent_return, int(won), int(is_pvp),
            json.dumps(player_allocation) if player_allocation else None,
            json.dumps(opponent_allocation) if opponent_allocation else None,
            scenario_key,
        ),
    )
    c.commit()
    row = c.execute("SELECT * FROM guest_battles WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


def get_battles(player_name: str | None = None, limit: int = 50) -> list[dict]:
    c = _conn()
    if player_name:
        rows = c.execute(
            "SELECT * FROM guest_battles WHERE player_name = ? ORDER BY played_at DESC LIMIT ?",
            (player_name, limit),
        ).fetchall()
    else:
        rows = c.execute(
            "SELECT * FROM guest_battles ORDER BY played_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Leaderboards
# ---------------------------------------------------------------------------

def get_iq_leaderboard(limit: int = 5) -> list[dict]:
    rows = _conn().execute(
        "SELECT username AS player_name, display_name, iq, highscore FROM guest_users ORDER BY iq DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_highscore_leaderboard(limit: int = 5) -> list[dict]:
    rows = _conn().execute(
        "SELECT username AS player_name, display_name, iq, highscore FROM guest_users WHERE highscore > -999.0 ORDER BY highscore DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_relative_return_leaderboard(limit: int = 5) -> list[dict]:
    """Top battles ranked by player_return - opponent_return (margin of victory)."""
    rows = _conn().execute(
        """SELECT player_name, opponent_name, strategy_name, player_return, opponent_return,
                  (player_return - opponent_return) AS relative_return, played_at
           FROM guest_battles
           WHERE won = 1
           ORDER BY relative_return DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

def save_strategies(username: str, strategies: list[dict]) -> None:
    """Replace all strategies for a user (full sync from client)."""
    c = _conn()
    c.execute("DELETE FROM guest_strategies WHERE username = ?", (username.lower(),))
    for s in strategies:
        c.execute(
            """INSERT INTO guest_strategies (username, name, allocation, selected_assets, scenario_key, result)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                username.lower(),
                s.get("name", ""),
                json.dumps(s.get("allocation", {})),
                json.dumps(s.get("selectedAssets")) if s.get("selectedAssets") else None,
                s.get("scenario_key"),
                json.dumps(s.get("result")) if s.get("result") else None,
            ),
        )
    c.commit()


def get_strategies(username: str) -> list[dict]:
    rows = _conn().execute(
        "SELECT * FROM guest_strategies WHERE username = ? ORDER BY id ASC",
        (username.lower(),),
    ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["allocation"] = json.loads(d["allocation"]) if d["allocation"] else {}
        d["selectedAssets"] = json.loads(d["selected_assets"]) if d.get("selected_assets") else None
        d["result"] = json.loads(d["result"]) if d.get("result") else None
        d.pop("selected_assets", None)
        result.append(d)
    return result
