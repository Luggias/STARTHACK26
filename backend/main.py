from dotenv import load_dotenv
import os
import pathlib

# Load .env BEFORE any other imports that depend on env vars (e.g., Supabase client)
_project_root = pathlib.Path(__file__).resolve().parent.parent
load_dotenv(_project_root / ".env")

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import time

from db.database import create, read, update, delete
from backend.data.historical import (
    ASSET_CLASSES,
    SCENARIOS,
    get_scenario_list,
    get_scenario_detail,
    simulate_portfolio,
)
from backend.battle import (
    create_room,
    find_open_room,
    get_room,
    handle_ws_message,
    handle_disconnect,
)

# Warn about missing env vars but don't crash — DB endpoints will fail gracefully
for key in ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"]:
    if not os.getenv(key):
        import warnings
        warnings.warn(f"Missing env var: {key} — related features will be unavailable")

app = FastAPI(title="Cache Me If You Can", version="0.1.0")

# CORS: allow Next.js dev server + Vercel production
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8501",
        frontend_url,
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_client = anthropic.Anthropic() if os.getenv("ANTHROPIC_API_KEY") else None


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
# AI endpoints
# ---------------------------------------------------------------------------

class PromptRequest(BaseModel):
    message: str
    system: str = "You are a helpful assistant."


@app.post("/ai/chat")
def chat(req: PromptRequest):
    if not ai_client:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not configured")
    response = ai_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=req.system,
        messages=[{"role": "user", "content": req.message}],
    )
    return {"reply": response.content[0].text}


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
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"insight": response.content[0].text}
    except Exception:
        return {"insight": f"Great game! The key lesson here: {lesson}"}


# ---------------------------------------------------------------------------
# Player registration
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
    """List all available historical scenarios (metadata only)."""
    return {"scenarios": get_scenario_list()}


@app.get("/scenarios/{key}")
def get_scenario(key: str):
    """Get full scenario data including asset descriptions."""
    detail = get_scenario_detail(key)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Scenario '{key}' not found")
    return detail


@app.get("/assets")
def list_assets():
    """Get all asset class definitions."""
    return {"assets": ASSET_CLASSES}


class SimulateRequest(BaseModel):
    allocation: dict
    scenario_key: str


@app.post("/simulate")
def run_simulation(req: SimulateRequest):
    """Simulate a portfolio through a historical scenario."""
    if req.scenario_key not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{req.scenario_key}' not found")

    try:
        result = simulate_portfolio(req.allocation, req.scenario_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Battle rooms (REST endpoints for creation/discovery)
# ---------------------------------------------------------------------------

class BattleCreate(BaseModel):
    player_id: str
    username: str


@app.post("/battles")
def create_battle(req: BattleCreate):
    """Create a new battle room."""
    room = create_room(req.player_id, req.username)
    return {"room_id": room.room_id, "status": room.status.value}


@app.get("/battles/open")
def find_open_battle():
    """Find a waiting battle room to join."""
    room = find_open_room()
    if not room:
        return {"room": None}
    return {
        "room": {
            "room_id": room.room_id,
            "player1_username": room.player1.username if room.player1 else None,
        }
    }


@app.get("/battles/{room_id}")
def get_battle(room_id: str):
    """Get battle room status and results."""
    room = get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {
        "room_id": room.room_id,
        "status": room.status.value,
        "player1": room.player1.username if room.player1 else None,
        "player2": room.player2.username if room.player2 else None,
        "results": room.results,
    }


# ---------------------------------------------------------------------------
# Battle WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/battle/{room_id}")
async def battle_websocket(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for real-time battle communication."""
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
# Generic CRUD (existing)
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
# File upload (existing)
# ---------------------------------------------------------------------------

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "path": path}
