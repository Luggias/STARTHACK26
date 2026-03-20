from dotenv import load_dotenv
import os
import pathlib

# Load .env BEFORE any other imports that depend on env vars (e.g., Supabase client)
_project_root = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from openai import OpenAI
import time
import uuid

from db.database import create, read, update, delete, upsert
from data.historical import (
    ASSET_CLASSES,
    SCENARIOS,
    get_scenario_list,
    get_scenario_detail,
    simulate_portfolio,
)
from battle import (
    Player,
    create_room,
    find_open_room,
    get_room,
    handle_ws_message,
    handle_disconnect,
    create_private_room,
    get_room_by_invite,
)
from auth import (
    hash_password,
    verify_password,
    create_jwt,
    get_current_user,
)
from ticker import fetch_ticker_prices
from data.gbm import simulate_gbm, simulate_montecarlo
from db.sqlite_store import (
    init_db as _init_sqlite,
    get_user as _sqlite_get_user,
    create_user as _sqlite_create_user,
    update_user_stats as _sqlite_update_user_stats,
    save_battle as _sqlite_save_battle,
    get_battles as _sqlite_get_battles,
    get_iq_leaderboard as _sqlite_get_iq_leaderboard,
    get_highscore_leaderboard as _sqlite_get_highscore_leaderboard,
    get_relative_return_leaderboard as _sqlite_get_relative_return_leaderboard,
    save_strategies as _sqlite_save_strategies,
    get_strategies as _sqlite_get_strategies,
)

# Warn about missing env vars but don't crash — DB endpoints will fail gracefully
for key in ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"]:
    if not os.getenv(key):
        import warnings
        warnings.warn(f"Missing env var: {key} — related features will be unavailable")

app = FastAPI(title="Cache Me If You Can", version="2.0.0")

# CORS: allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_client = OpenAI() if os.getenv("OPENAI_API_KEY") else None

# Initialise SQLite persistent store (creates tables on first run)
_init_sqlite()

# ---------------------------------------------------------------------------
# In-memory fallback store (used when Supabase is not configured)
# ---------------------------------------------------------------------------
_HAS_DB = bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY"))

# email -> user dict
_mem_users: dict[str, dict] = {}
# user_id -> list of strategies
_mem_strategies: dict[str, list] = {}
# user_id -> longterm portfolio
_mem_portfolios: dict[str, dict] = {}


def _db_create_user(row: dict) -> dict:
    if _HAS_DB:
        result = create("users", row)
        return result.data[0] if result.data else row
    uid = str(uuid.uuid4())
    user = {**row, "id": uid}
    _mem_users[row["email"]] = user
    return user


def _db_find_user_by_email(email: str) -> dict | None:
    if _HAS_DB:
        rows = read("users", filters={"email": email}, limit=1)
        return rows[0] if rows else None
    return _mem_users.get(email)


def _db_find_user_by_id(uid: str) -> dict | None:
    if _HAS_DB:
        rows = read("users", filters={"id": uid}, limit=1)
        return rows[0] if rows else None
    for u in _mem_users.values():
        if u.get("id") == uid:
            return u
    return None


def _db_save_strategy(row: dict) -> dict:
    if _HAS_DB:
        result = create("sandbox_strategies", row)
        return result.data[0] if result.data else row
    uid = row["user_id"]
    strat = {**row, "id": str(uuid.uuid4())}
    _mem_strategies.setdefault(uid, []).append(strat)
    return strat


def _db_get_strategies(user_id: str) -> list:
    if _HAS_DB:
        return read("sandbox_strategies", filters={"user_id": user_id})
    return _mem_strategies.get(user_id, [])


def _db_upsert_portfolio(row: dict) -> dict:
    if _HAS_DB:
        result = upsert("longterm_portfolio", row, on_conflict="user_id")
        return result.data[0] if result.data else row
    _mem_portfolios[row["user_id"]] = row
    return row


def _db_get_portfolio(user_id: str) -> dict | None:
    if _HAS_DB:
        rows = read("longterm_portfolio", filters={"user_id": user_id}, limit=1)
        return rows[0] if rows else None
    return _mem_portfolios.get(user_id)


@app.middleware("http")
async def log_request(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000)
    print(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok", "project": "Cache Me If You Can"}


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    age: Optional[int] = None
    country: Optional[str] = None
    username: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/register")
def auth_register(req: RegisterRequest):
    """Register a new user with email + password."""
    username = req.username or req.email.split("@")[0]
    # Check if email already exists
    existing = _db_find_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = hash_password(req.password)
    try:
        user = _db_create_user({
            "username": username,
            "full_name": req.full_name,
            "email": req.email,
            "password_hash": password_hash,
            "age": req.age,
            "country": req.country,
            "invest_iq": 0,
            "risk_profile": "unknown",
        })
        if _HAS_DB:
            try:
                create("leaderboard", {"user_id": user["id"]})
            except Exception:
                pass
        token = create_jwt(user["id"], user["username"])
        return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login")
def auth_login(req: LoginRequest):
    """Login with email + password."""
    try:
        user = _db_find_user_by_email(req.email)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_jwt(user["id"], user["username"])
        return {"token": token, "user": {k: v for k, v in user.items() if k != "password_hash"}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/auth/me")
def auth_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    try:
        user = _db_find_user_by_id(current_user["id"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {k: v for k, v in user.items() if k != "password_hash"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Ticker prices
# ---------------------------------------------------------------------------

@app.get("/ticker/prices")
def get_ticker_prices():
    """Get live or GBM-simulated ticker prices for the ticker bar."""
    return {"prices": fetch_ticker_prices()}


# ---------------------------------------------------------------------------
# AI endpoints
# ---------------------------------------------------------------------------

class PromptRequest(BaseModel):
    message: str
    system: str = "You are a helpful assistant."


@app.post("/ai/chat")
def chat(req: PromptRequest):
    if not ai_client:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")
    response = ai_client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": req.system},
            {"role": "user", "content": req.message},
        ],
    )
    return {"reply": response.choices[0].message.content}


class InsightRequest(BaseModel):
    portfolio1: dict
    portfolio2: dict
    scenario_key: str
    result: dict


@app.post("/ai/insight")
def get_ai_insight(req: InsightRequest):
    """Generate educational AI insight comparing two battle portfolios."""
    scenario = SCENARIOS.get(req.scenario_key, {})
    scenario_name = scenario.get("name", req.scenario_key)
    lesson = scenario.get("lesson", "")

    prompt = (
        f"Two players just competed in a financial portfolio battle during the "
        f"'{scenario_name}' scenario.\n\n"
        f"Player 1 portfolio: {req.portfolio1}\n"
        f"Player 1 result: return={req.result.get('p1_return', 'N/A')}%, "
        f"Sharpe={req.result.get('p1_sharpe', 'N/A')}\n\n"
        f"Player 2 portfolio: {req.portfolio2}\n"
        f"Player 2 result: return={req.result.get('p2_return', 'N/A')}%, "
        f"Sharpe={req.result.get('p2_sharpe', 'N/A')}\n\n"
        f"The key lesson of this scenario: {lesson}\n\n"
        f"In 3-4 sentences, explain to a complete beginner WHY one portfolio did better "
        f"than the other. Reference the specific assets chosen and what happened historically. "
        f"Be encouraging, educational, and use simple language. No jargon."
    )

    system_prompt = (
        "You are a friendly financial educator for young adults who have never invested before. "
        "Your goal is to make financial concepts feel approachable and exciting, not scary. "
        "Always be encouraging — even when explaining losses. Use analogies when helpful."
    )

    if not ai_client:
        return {"insight": f"Great game! The key lesson here: {lesson}"}

    try:
        response = ai_client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=300,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        return {"insight": response.choices[0].message.content}
    except Exception:
        return {"insight": f"Great game! The key lesson here: {lesson}"}


class CoachRequest(BaseModel):
    strategies: list[dict]


@app.post("/ai/coach")
def ai_coach(req: CoachRequest, current_user: dict = Depends(get_current_user)):
    """Analyse user's strategy history and return investing personality assessment."""
    if not req.strategies:
        return {
            "personality_type": "Curious Explorer",
            "strengths": ["Open to learning", "Starting the journey"],
            "blindspots": ["Need more practice data"],
            "risk_profile": "unknown",
            "narrative": "You haven't saved enough strategies yet. Run a few simulations and come back!",
        }

    summary = "\n".join(
        f"- Strategy '{s.get('name', 'unnamed')}': allocation={s.get('allocation', {})}, "
        f"return={s.get('result', {}).get('total_return', 'N/A')}%, "
        f"Sharpe={s.get('result', {}).get('sharpe_ratio', 'N/A')}"
        for s in req.strategies[:10]
    )

    prompt = (
        f"A user has made the following investment strategy choices:\n{summary}\n\n"
        "Based on their allocation patterns and results, provide:\n"
        "1. Their investing personality type (e.g. 'Aggressive Speculator', 'Cautious Balancer', 'Growth Hunter')\n"
        "2. 2-3 strengths they demonstrate\n"
        "3. 2-3 blindspots or risks to watch out for\n"
        "4. Their inferred risk profile: conservative, moderate, or aggressive\n"
        "5. A 2-3 sentence narrative summary\n\n"
        "Respond in JSON format: {personality_type, strengths[], blindspots[], risk_profile, narrative}"
    )

    if not ai_client:
        return {
            "personality_type": "Balanced Builder",
            "strengths": ["Diversified thinking", "Risk awareness"],
            "blindspots": ["Could explore more asset classes"],
            "risk_profile": "moderate",
            "narrative": "You tend to build balanced portfolios. Keep experimenting to refine your style.",
        }

    try:
        response = ai_client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=500,
            messages=[
                {"role": "system", "content": "You are a financial personality assessor. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
        )
        import json
        text = response.choices[0].message.content
        # Extract JSON if wrapped in markdown
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception:
        return {
            "personality_type": "Balanced Builder",
            "strengths": ["Diversified thinking", "Risk awareness"],
            "blindspots": ["Could explore more asset classes"],
            "risk_profile": "moderate",
            "narrative": "You tend to build balanced portfolios. Keep experimenting to refine your style.",
        }


# ---------------------------------------------------------------------------
# Player registration (legacy — kept for backward compat)
# ---------------------------------------------------------------------------

class PlayerCreate(BaseModel):
    username: str


@app.post("/players")
def register_player(req: PlayerCreate):
    """Create a new player with just a username."""
    try:
        result = create("players", {"username": req.username})
        return {"player": result.data[0] if result.data else {"username": req.username}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Scenarios & simulation
# ---------------------------------------------------------------------------

@app.get("/scenarios")
def list_scenarios():
    return {"scenarios": get_scenario_list()}


@app.get("/scenarios/{key}")
def get_scenario(key: str):
    detail = get_scenario_detail(key)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Scenario '{key}' not found")
    return detail


@app.get("/assets")
def list_assets():
    return {"assets": ASSET_CLASSES}


class SimulateRequest(BaseModel):
    allocation: dict
    scenario_key: str


@app.post("/simulate")
def run_simulation(req: SimulateRequest):
    if req.scenario_key not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{req.scenario_key}' not found")
    try:
        result = simulate_portfolio(req.allocation, req.scenario_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# GBM simulation
# ---------------------------------------------------------------------------

class GBMRequest(BaseModel):
    allocation: dict
    years: int = 20
    seed: Optional[int] = None
    inject_events: bool = True


@app.post("/simulate/gbm")
def run_gbm(req: GBMRequest):
    try:
        return simulate_gbm(req.allocation, req.years, req.seed, req.inject_events)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class MonteCarloRequest(BaseModel):
    allocation: dict
    years: int = 20
    n_paths: int = 200
    seed: Optional[int] = None


@app.post("/simulate/montecarlo")
def run_montecarlo(req: MonteCarloRequest):
    try:
        return simulate_montecarlo(req.allocation, req.years, req.n_paths, req.seed)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Strategy management
# ---------------------------------------------------------------------------

class StrategySaveRequest(BaseModel):
    name: str
    allocation: dict
    scenario_key: str
    result: dict


# Asset unlock progression
ASSET_UNLOCK_ORDER = ["stocks", "bonds", "gold", "cash", "crypto"]


@app.post("/strategies")
def save_strategy(req: StrategySaveRequest, current_user: dict = Depends(get_current_user)):
    """Save a sandbox strategy and determine next asset unlock."""
    try:
        row = {
            "user_id": current_user["id"],
            "name": req.name,
            "allocation": req.allocation,
            "scenario_key": req.scenario_key,
            "result": req.result,
        }
        saved = _db_save_strategy(row)
        all_strats = _db_get_strategies(current_user["id"])
        count = len(all_strats)
        unlocked_next = ASSET_UNLOCK_ORDER[min(count, len(ASSET_UNLOCK_ORDER) - 1)]
        return {"strategy": saved, "unlocked_next": unlocked_next}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/strategies/me")
def my_strategies(current_user: dict = Depends(get_current_user)):
    try:
        return {"strategies": _db_get_strategies(current_user["id"])}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/strategies/top3")
def top3_strategies(current_user: dict = Depends(get_current_user)):
    try:
        strategies = _db_get_strategies(current_user["id"])
        def get_return(s):
            r = s.get("result", {})
            return r.get("total_return", -999) if isinstance(r, dict) else -999
        top3 = sorted(strategies, key=get_return, reverse=True)[:3]
        return {"strategies": top3}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Long-term portfolio
# ---------------------------------------------------------------------------

class LongtermPortfolioRequest(BaseModel):
    allocation: dict
    initial_amount_chf: float = 10000.0


@app.post("/portfolio/longterm")
def init_longterm_portfolio(req: LongtermPortfolioRequest, current_user: dict = Depends(get_current_user)):
    try:
        row = {
            "user_id": current_user["id"],
            "allocation": req.allocation,
            "initial_amount_chf": req.initial_amount_chf,
        }
        saved = _db_upsert_portfolio(row)
        return {"portfolio": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/portfolio/longterm/me")
def get_longterm_portfolio(current_user: dict = Depends(get_current_user)):
    try:
        portfolio = _db_get_portfolio(current_user["id"])
        if not portfolio:
            return {"portfolio": None}
        # Compute current value via GBM from started_at to now
        from datetime import datetime, timezone
        started_at = portfolio.get("started_at")
        if started_at:
            try:
                start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                years_elapsed = max((now - start).days / 365.25, 0)
                if years_elapsed > 0:
                    sim = simulate_gbm(
                        portfolio["allocation"],
                        years=max(1, int(years_elapsed) + 1),
                        inject_events=False,
                    )
                    # Take value at the months elapsed
                    months_elapsed = int(years_elapsed * 12)
                    idx = min(months_elapsed, len(sim["values"]) - 1)
                    initial = float(portfolio.get("initial_amount_chf", 10000))
                    scale = initial / 10000.0
                    current_value = sim["values"][idx] * scale
                    portfolio["current_value"] = round(current_value, 2)
                    portfolio["current_return"] = round((current_value / initial - 1) * 100, 2)
            except Exception:
                portfolio["current_value"] = portfolio.get("initial_amount_chf", 10000)
                portfolio["current_return"] = 0.0
        return {"portfolio": portfolio}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/portfolio/longterm/history")
def get_longterm_history(current_user: dict = Depends(get_current_user)):
    try:
        portfolio = _db_get_portfolio(current_user["id"])
        if not portfolio:
            return {"history": None}
        initial = float(portfolio.get("initial_amount_chf", 10000))
        scale = initial / 10000.0
        sim = simulate_gbm(portfolio["allocation"], years=20, inject_events=False)
        return {
            "months": sim["months"],
            "values": [round(v * scale, 2) for v in sim["values"]],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Battle rooms (REST)
# ---------------------------------------------------------------------------

class BattleCreate(BaseModel):
    player_id: str
    username: str
    allocation: Optional[dict] = None


@app.post("/battles")
def create_battle(req: BattleCreate):
    room = create_room(req.player_id, req.username)
    if req.allocation:
        room.player1.portfolio = req.allocation
    return {"room_id": room.room_id, "status": room.status.value}


@app.post("/battles/quickmatch")
def quickmatch(req: BattleCreate):
    """Atomically join an open room or create a new one."""
    import random as _rnd
    room = find_open_room()
    if room and room.player1 and room.player1.player_id != req.player_id:
        # Join existing room as player2
        room.player2 = Player(player_id=req.player_id, username=req.username)
        if req.allocation:
            room.player2.portfolio = req.allocation
        seed = _rnd.randint(0, 2**31)
        # Mark both players as in_battle
        p1 = _online_players.get(room.player1.player_id)
        p2 = _online_players.get(req.player_id)
        if p1:
            p1["in_battle"] = True
        if p2:
            p2["in_battle"] = True
        return {
            "room_id": room.room_id,
            "status": room.status.value,
            "joined": True,
            "opponent": room.player1.username,
            "opponent_allocation": room.player1.portfolio,
            "seed": seed,
        }
    # No open room — create a new one
    new_room = create_room(req.player_id, req.username)
    if req.allocation:
        new_room.player1.portfolio = req.allocation
    return {
        "room_id": new_room.room_id,
        "status": new_room.status.value,
        "joined": False,
        "opponent": None,
        "opponent_allocation": None,
        "seed": None,
    }


@app.delete("/battles/{room_id}")
def cancel_battle(room_id: str):
    """Remove a waiting room (used when a player cancels matchmaking)."""
    from battle import rooms, RoomStatus
    room = rooms.get(room_id)
    if room and room.status == RoomStatus.WAITING and not room.is_full():
        del rooms[room_id]
        return {"ok": True}
    return {"ok": False}


@app.get("/battles/open")
def find_open_battle():
    room = find_open_room()
    if not room:
        return {"room": None}
    return {
        "room": {
            "room_id": room.room_id,
            "player1_username": room.player1.username if room.player1 else None,
        }
    }


class PrivateBattleCreate(BaseModel):
    player_id: str
    username: str


@app.post("/battles/private")
def create_private_battle(req: PrivateBattleCreate):
    room, invite_code = create_private_room(req.player_id, req.username)
    return {"room_id": room.room_id, "invite_code": invite_code, "status": room.status.value}


@app.get("/battles/invite/{code}")
def get_battle_by_invite(code: str):
    room = get_room_by_invite(code)
    if not room:
        raise HTTPException(status_code=404, detail="Invite code not found")
    return {
        "room_id": room.room_id,
        "player1_username": room.player1.username if room.player1 else None,
    }


@app.get("/battles/{room_id}")
def get_battle(room_id: str):
    room = get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "room_id": room.room_id,
        "status": room.status.value,
        "player1": room.player1.username if room.player1 else None,
        "player2": room.player2.username if room.player2 else None,
        "player1_allocation": room.player1.portfolio if room.player1 else None,
        "player2_allocation": room.player2.portfolio if room.player2 else None,
        "results": room.results,
    }


@app.get("/battles/history")
def get_battle_history(limit: int = 50):
    """Fetch recent battle results from the database."""
    if not _HAS_DB:
        return {"results": []}
    try:
        rows = read("battle_results")
        # Sort by played_at descending, limit
        rows.sort(key=lambda r: r.get("played_at", ""), reverse=True)
        return {"results": rows[:limit]}
    except Exception as e:
        return {"results": [], "error": str(e)}


@app.get("/battles/history/{player_name}")
def get_player_battle_history(player_name: str, limit: int = 20):
    """Fetch battle results for a specific player."""
    if not _HAS_DB:
        return {"results": []}
    try:
        rows = read("battle_results", filters={"player_name": player_name})
        rows.sort(key=lambda r: r.get("played_at", ""), reverse=True)
        return {"results": rows[:limit]}
    except Exception as e:
        return {"results": [], "error": str(e)}


# ---------------------------------------------------------------------------
# Username registry — unique usernames, in-memory for hackathon
# ---------------------------------------------------------------------------

class ClaimUsernameReq(BaseModel):
    username: str
    password: str = ""


@app.post("/username/claim")
def claim_username(req: ClaimUsernameReq):
    name = req.username.strip()
    if not name or len(name) > 20:
        raise HTTPException(400, "Username must be 1-20 characters")
    if not req.password or len(req.password) < 3:
        raise HTTPException(400, "Password must be at least 3 characters")
    existing = _sqlite_get_user(name)
    if existing:
        # Username exists — verify password (login)
        if not verify_password(req.password, existing["password_hash"]):
            raise HTTPException(401, "Wrong password")
        return {"ok": True, "username": existing["display_name"]}
    # New username — register
    user = _sqlite_create_user(name, name, hash_password(req.password))
    return {"ok": True, "username": user["display_name"]}


@app.post("/username/release")
def release_username(req: ClaimUsernameReq):
    # No-op: we don't delete persistent users
    return {"ok": True}


# ---------------------------------------------------------------------------
# Presence (REST) — tracks online players & battle challenges
# ---------------------------------------------------------------------------

# {player_id: {"username": str, "last_seen": float, "in_battle": bool}}
_online_players: dict[str, dict] = {}
# {target_id: {"from_id": str, "from_username": str, "room_id": str | None, "ts": float}}
_pending_challenges: dict[str, dict] = {}

PRESENCE_TIMEOUT = 8  # seconds before a player is considered offline


def _clean_stale_players():
    """Remove players who haven't sent a heartbeat recently."""
    now = time.time()
    stale = [pid for pid, info in _online_players.items() if now - info["last_seen"] > PRESENCE_TIMEOUT]
    for pid in stale:
        del _online_players[pid]
        _pending_challenges.pop(pid, None)


class HeartbeatReq(BaseModel):
    player_id: str
    username: str
    has_strategy: bool = False


@app.post("/presence/heartbeat")
def presence_heartbeat(req: HeartbeatReq):
    _clean_stale_players()
    _online_players[req.player_id] = {
        "username": req.username,
        "last_seen": time.time(),
        "in_battle": _online_players.get(req.player_id, {}).get("in_battle", False),
        "has_strategy": req.has_strategy,
    }
    # Check for incoming challenge
    challenge = _pending_challenges.get(req.player_id)
    if challenge and challenge.get("room_id"):
        # Accepted — return room_id, opponent allocation, seed, and opponent name, then clear
        room_id = challenge["room_id"]
        opp_alloc = challenge.get("opponent_allocation")
        seed = challenge.get("seed")
        opp_name = challenge.get("from_username", "Opponent")
        del _pending_challenges[req.player_id]
        # Mark as in_battle
        player = _online_players.get(req.player_id)
        if player:
            player["in_battle"] = True
        return {"go_to_battle": room_id, "opponent_allocation": opp_alloc, "seed": seed, "opponent_name": opp_name}
    return {"ok": True}


@app.get("/presence/online")
def presence_online():
    _clean_stale_players()
    return {
        "players": [
            {"id": pid, "username": info["username"], "in_battle": info["in_battle"], "has_strategy": info.get("has_strategy", False)}
            for pid, info in _online_players.items()
        ]
    }


class ChallengeReq(BaseModel):
    from_id: str
    target_id: str
    allocation: Optional[dict] = None


@app.post("/presence/challenge")
def presence_challenge(req: ChallengeReq):
    target = _online_players.get(req.target_id)
    sender = _online_players.get(req.from_id)
    if not target or not sender:
        raise HTTPException(404, "Player not found")
    if target.get("in_battle"):
        raise HTTPException(400, "Player is in battle")
    if sender.get("in_battle"):
        raise HTTPException(400, "You are already in a battle")
    if not target.get("has_strategy"):
        raise HTTPException(400, "Player has no strategy yet")
    if not sender.get("has_strategy"):
        raise HTTPException(400, "You need a strategy first")
    # Check if sender already has an outgoing challenge (prevent spamming multiple people)
    for tid, ch in _pending_challenges.items():
        if ch.get("from_id") == req.from_id and not ch.get("room_id") and time.time() - ch["ts"] < 30:
            if tid != req.target_id:
                raise HTTPException(400, "You already have a pending challenge")
    _pending_challenges[req.target_id] = {
        "from_id": req.from_id,
        "from_username": sender["username"],
        "from_allocation": req.allocation,
        "room_id": None,
        "ts": time.time(),
    }
    return {"sent": True}


@app.get("/presence/challenges/{player_id}")
def presence_get_challenges(player_id: str):
    challenge = _pending_challenges.get(player_id)
    if not challenge or challenge.get("room_id"):
        return {"challenge": None}
    # Expire old challenges (> 30s)
    if time.time() - challenge["ts"] > 30:
        del _pending_challenges[player_id]
        return {"challenge": None}
    return {"challenge": {"from_id": challenge["from_id"], "from_username": challenge["from_username"], "from_allocation": challenge.get("from_allocation")}}


class AcceptReq(BaseModel):
    player_id: str
    from_id: str
    allocation: Optional[dict] = None


@app.post("/presence/accept")
def presence_accept(req: AcceptReq):
    import random as _rnd
    challenge = _pending_challenges.get(req.player_id)
    if not challenge or challenge["from_id"] != req.from_id:
        raise HTTPException(404, "No pending challenge")
    accepter = _online_players.get(req.player_id)
    challenger = _online_players.get(req.from_id)
    if not accepter or not challenger:
        raise HTTPException(404, "Player offline")
    # Create battle room
    room = create_room(req.from_id, challenger["username"])
    room.player1.portfolio = challenge.get("from_allocation")
    room.player2 = Player(player_id=req.player_id, username=accepter["username"])
    room.player2.portfolio = req.allocation
    challenger["in_battle"] = True
    accepter["in_battle"] = True
    seed = _rnd.randint(0, 2**31)
    # Store room_id + allocations in both directions so both players discover it via heartbeat
    _pending_challenges[req.player_id] = {
        **challenge,
        "room_id": room.room_id,
        "opponent_allocation": challenge.get("from_allocation"),
        "seed": seed,
    }
    _pending_challenges[req.from_id] = {
        "from_id": req.player_id,
        "from_username": accepter["username"],
        "from_allocation": req.allocation,
        "room_id": room.room_id,
        "opponent_allocation": req.allocation,
        "seed": seed,
        "ts": time.time(),
    }
    return {
        "room_id": room.room_id,
        "opponent_allocation": challenge.get("from_allocation"),
        "seed": seed,
    }


class DeclineReq(BaseModel):
    player_id: str
    from_id: str


@app.post("/presence/decline")
def presence_decline(req: DeclineReq):
    _pending_challenges.pop(req.player_id, None)
    return {"ok": True}


class BattleEndReq(BaseModel):
    player_id: str


@app.post("/presence/battle-end")
def presence_battle_end(req: BattleEndReq):
    player = _online_players.get(req.player_id)
    if player:
        player["in_battle"] = False
    return {"ok": True}


# {player_id: target_player_id} — signals "I want a rematch with this person"
_rematch_requests: dict[str, str] = {}


class RematchReq(BaseModel):
    player_id: str
    opponent_id: str


@app.post("/presence/rematch")
def presence_rematch(req: RematchReq):
    _rematch_requests[req.player_id] = req.opponent_id
    # Check if opponent also requested rematch with us → mutual = go!
    if _rematch_requests.get(req.opponent_id) == req.player_id:
        # Both want rematch — clear requests
        _rematch_requests.pop(req.player_id, None)
        _rematch_requests.pop(req.opponent_id, None)
        return {"mutual": True}
    return {"mutual": False}


@app.get("/presence/rematch/{player_id}")
def presence_check_rematch(player_id: str):
    """Check if anyone requested a rematch with this player."""
    for pid, target in _rematch_requests.items():
        if target == player_id:
            return {"from_id": pid}
    return {"from_id": None}


# ---------------------------------------------------------------------------
# Guest stats & leaderboards (in-memory, no auth)
# ---------------------------------------------------------------------------

class ReportResultReq(BaseModel):
    player_name: str
    won: bool
    return_pct: float
    opponent_return_pct: float = 0.0
    is_pvp: bool
    opponent_name: str = "A.I. FUND"
    strategy_name: str = ""
    player_allocation: dict | None = None
    opponent_allocation: dict | None = None
    scenario_key: str | None = None


@app.post("/guest/report-result")
def guest_report_result(req: ReportResultReq):
    user = _sqlite_get_user(req.player_name)
    if not user:
        user = _sqlite_create_user(req.player_name, req.player_name, hash_password(""))
    iq = user["iq"]
    highscore = user.get("highscore", user.get("best_return", -999.0))
    # Award IQ for all battles: PvP gives more
    if req.is_pvp:
        iq = max(0, iq + (10 if req.won else 5))
    else:
        iq = max(0, iq + (5 if req.won else 2))
    if req.return_pct > highscore:
        highscore = req.return_pct
    _sqlite_update_user_stats(req.player_name, iq, highscore)
    _sqlite_save_battle(
        player_name=req.player_name,
        opponent_name=req.opponent_name,
        strategy_name=req.strategy_name,
        player_return=req.return_pct,
        opponent_return=req.opponent_return_pct,
        won=req.won,
        is_pvp=req.is_pvp,
        player_allocation=req.player_allocation,
        opponent_allocation=req.opponent_allocation,
        scenario_key=req.scenario_key,
    )
    return {"iq": iq, "highscore": highscore}


@app.get("/guest/leaderboard")
def guest_leaderboard():
    return {
        "iq_leaderboard": _sqlite_get_iq_leaderboard(),
        "highscore_leaderboard": _sqlite_get_highscore_leaderboard(),
        "relative_return_leaderboard": _sqlite_get_relative_return_leaderboard(),
    }


@app.get("/guest/stats/{player_name}")
def guest_stats(player_name: str):
    user = _sqlite_get_user(player_name)
    iq = user["iq"] if user else 0
    highscore = user.get("highscore", user.get("best_return", -999.0)) if user else -999.0
    return {"player_name": player_name, "iq": iq, "highscore": highscore}


class SyncStrategiesReq(BaseModel):
    player_name: str
    strategies: list[dict]


@app.post("/guest/strategies/sync")
def guest_sync_strategies(req: SyncStrategiesReq):
    _sqlite_save_strategies(req.player_name, req.strategies)
    return {"ok": True, "count": len(req.strategies)}


@app.get("/guest/strategies/{player_name}")
def guest_get_strategies(player_name: str):
    return {"strategies": _sqlite_get_strategies(player_name)}


@app.get("/guest/battles")
def guest_all_battles(limit: int = 50):
    return {"battles": _sqlite_get_battles(None, limit)}


@app.get("/guest/battles/{player_name}")
def guest_player_battles(player_name: str, limit: int = 50):
    return {"battles": _sqlite_get_battles(player_name, limit)}


# ---------------------------------------------------------------------------
# Battle WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/battle/{room_id}")
async def battle_websocket(websocket: WebSocket, room_id: str):
    await websocket.accept()
    room = get_room(room_id)
    if not room:
        await websocket.send_text('{"type":"error","message":"Room not found"}')
        await websocket.close()
        return
    try:
        while True:
            raw = await websocket.receive_text()
            await handle_ws_message(room, websocket, raw)
    except WebSocketDisconnect:
        await handle_disconnect(room, websocket)


# ---------------------------------------------------------------------------
# Clans
# ---------------------------------------------------------------------------

class ClanCreate(BaseModel):
    name: str


@app.post("/clans")
def create_clan(req: ClanCreate, current_user: dict = Depends(get_current_user)):
    import secrets
    join_code = secrets.token_urlsafe(6).upper()
    try:
        result = create("clans", {
            "name": req.name,
            "join_code": join_code,
            "created_by": current_user["id"],
        })
        clan = result.data[0] if result.data else None
        if not clan:
            raise HTTPException(status_code=400, detail="Failed to create clan")
        # Creator joins automatically
        create("clan_members", {"clan_id": clan["id"], "user_id": current_user["id"]})
        return {"clan": clan}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ClanJoin(BaseModel):
    join_code: str


@app.post("/clans/join")
def join_clan(req: ClanJoin, current_user: dict = Depends(get_current_user)):
    try:
        clans = read("clans", filters={"join_code": req.join_code}, limit=1)
        if not clans:
            raise HTTPException(status_code=404, detail="Clan not found")
        clan = clans[0]
        try:
            create("clan_members", {"clan_id": clan["id"], "user_id": current_user["id"]})
        except Exception:
            pass  # Already a member
        return {"clan": clan}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/clans/{clan_id}")
def get_clan(clan_id: str):
    try:
        clans = read("clans", filters={"id": clan_id}, limit=1)
        if not clans:
            raise HTTPException(status_code=404, detail="Clan not found")
        members = read("clan_members", filters={"clan_id": clan_id})
        return {"clan": clans[0], "members": members}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/clans/{clan_id}/leaderboard")
def clan_leaderboard(clan_id: str):
    try:
        members = read("clan_members", filters={"clan_id": clan_id})
        member_ids = [m["user_id"] for m in members]
        rows = []
        for uid in member_ids:
            lb = read("leaderboard", filters={"user_id": uid}, limit=1)
            users = read("users", filters={"id": uid}, limit=1)
            if lb and users:
                entry = {**lb[0], "username": users[0].get("username", "?")}
                rows.append(entry)
        rows.sort(key=lambda r: r.get("invest_iq", 0), reverse=True)
        return {"leaderboard": rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/leaderboard")
def global_leaderboard():
    try:
        lb = read("leaderboard")
        enriched = []
        for entry in lb:
            users = read("users", filters={"id": entry["user_id"]}, limit=1)
            if users:
                enriched.append({**entry, "username": users[0].get("username", "?")})
        enriched.sort(key=lambda r: r.get("invest_iq", 0), reverse=True)
        return {"leaderboard": enriched[:50]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Generic CRUD (legacy)
# ---------------------------------------------------------------------------

@app.get("/data/{table}")
def get_rows(table: str, request: Request):
    filters = dict(request.query_params) or None
    try:
        return read(table, filters=filters)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/data/{table}")
def create_row(table: str, row: dict):
    try:
        return create(table, row)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/data/{table}/{id}")
def update_row(table: str, id: str, changes: dict):
    try:
        return update(table, id, changes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/data/{table}/{id}")
def delete_row(table: str, id: str):
    try:
        delete(table, id)
        return {"deleted": id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# File upload (legacy)
# ---------------------------------------------------------------------------

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "path": path}
