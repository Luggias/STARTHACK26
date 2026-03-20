"""SQLite persistent data layer for guest users and battle records.

DB file: backend/data/game.db (auto-created on first use).
"""

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
            best_return REAL DEFAULT -999.0,
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
            played_at TEXT DEFAULT (datetime('now'))
        );
    """)
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


def update_user_stats(username: str, iq: int, best_return: float) -> None:
    c = _conn()
    c.execute(
        "UPDATE guest_users SET iq = ?, best_return = ? WHERE username = ?",
        (iq, best_return, username.lower()),
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
) -> dict:
    c = _conn()
    cur = c.execute(
        """INSERT INTO guest_battles
           (player_name, opponent_name, strategy_name, player_return, opponent_return, won, is_pvp)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (player_name, opponent_name, strategy_name, player_return, opponent_return, int(won), int(is_pvp)),
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
        "SELECT username AS player_name, display_name, iq, best_return FROM guest_users ORDER BY iq DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_highscore_leaderboard(limit: int = 5) -> list[dict]:
    rows = _conn().execute(
        "SELECT username AS player_name, display_name, iq, best_return FROM guest_users WHERE best_return > -999.0 ORDER BY best_return DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]
