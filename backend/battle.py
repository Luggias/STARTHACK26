"""
WebSocket battle room state machine.

Manages real-time 1v1 portfolio battles with the lifecycle:
WAITING -> BUILDING -> LOCKED -> SIMULATING -> FINISHED
"""

import asyncio
import json
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import WebSocket

from data.historical import (
    SCENARIOS,
    compute_battle_score,
    simulate_portfolio,
)


class RoomStatus(str, Enum):
    WAITING = "waiting"
    BUILDING = "building"
    LOCKED = "locked"
    SIMULATING = "simulating"
    FINISHED = "finished"


@dataclass
class Player:
    player_id: str
    username: str
    ws: Optional[WebSocket] = None
    portfolio: Optional[dict] = None
    ready: bool = False


@dataclass
class BattleRoom:
    room_id: str
    status: RoomStatus = RoomStatus.WAITING
    player1: Optional[Player] = None
    player2: Optional[Player] = None
    scenario_key: Optional[str] = None
    results: Optional[dict] = None

    def is_full(self) -> bool:
        return self.player1 is not None and self.player2 is not None

    def both_ready(self) -> bool:
        return (
            self.player1 is not None
            and self.player2 is not None
            and self.player1.ready
            and self.player2.ready
        )


# In-memory room storage (sufficient for hackathon scale)
rooms: dict[str, BattleRoom] = {}

# Private rooms indexed by invite code
private_rooms: dict[str, BattleRoom] = {}

# Building phase duration in seconds
BUILDING_TIME_LIMIT = 60
# Delay between simulation ticks in seconds
TICK_DELAY = 1.0


def create_room(player_id: str, username: str) -> BattleRoom:
    """Create a new battle room with player1."""
    room_id = str(uuid.uuid4())[:8]
    room = BattleRoom(
        room_id=room_id,
        player1=Player(player_id=player_id, username=username),
    )
    rooms[room_id] = room
    return room


def find_open_room() -> Optional[BattleRoom]:
    """Find the first room waiting for a second player."""
    for room in rooms.values():
        if room.status == RoomStatus.WAITING and not room.is_full():
            return room
    return None


def get_room(room_id: str) -> Optional[BattleRoom]:
    """Get a room by ID."""
    return rooms.get(room_id)


def create_private_room(player_id: str, username: str) -> tuple[BattleRoom, str]:
    """Create a private battle room and return (room, invite_code)."""
    import secrets
    invite_code = secrets.token_urlsafe(8).upper()
    room_id = str(uuid.uuid4())[:8]
    room = BattleRoom(
        room_id=room_id,
        player1=Player(player_id=player_id, username=username),
    )
    rooms[room_id] = room
    private_rooms[invite_code] = room
    return room, invite_code


def get_room_by_invite(invite_code: str) -> Optional[BattleRoom]:
    """Find a private room by its invite code."""
    return private_rooms.get(invite_code)


async def broadcast(room: BattleRoom, message: dict) -> None:
    """Send a JSON message to all connected players in a room."""
    data = json.dumps(message)
    for player in [room.player1, room.player2]:
        if player and player.ws:
            try:
                await player.ws.send_text(data)
            except Exception:
                pass


async def send_to(player: Optional[Player], message: dict) -> None:
    """Send a JSON message to a single player."""
    if player and player.ws:
        try:
            await player.ws.send_text(json.dumps(message))
        except Exception:
            pass


async def handle_join(room: BattleRoom, ws: WebSocket, data: dict) -> None:
    """Handle a player joining a room via WebSocket."""
    player_id = data.get("player_id", "")
    username = data.get("username", "Player")

    if room.player1 and room.player1.player_id == player_id:
        room.player1.ws = ws
        if not room.is_full():
            await send_to(room.player1, {"type": "waiting"})
    elif room.player2 and room.player2.player_id == player_id:
        room.player2.ws = ws
    elif room.player1 and not room.player2:
        room.player2 = Player(player_id=player_id, username=username, ws=ws)
    else:
        await ws.send_text(json.dumps({"type": "error", "message": "Room is full"}))
        return

    # Start building once both players have WebSocket connections
    if (
        room.status == RoomStatus.WAITING
        and room.is_full()
        and room.player1 and room.player1.ws
        and room.player2 and room.player2.ws
    ):
        await start_building(room)


async def start_building(room: BattleRoom) -> None:
    """Transition to BUILDING state and notify both players."""
    room.status = RoomStatus.BUILDING

    # Pick a random scenario
    room.scenario_key = random.choice(list(SCENARIOS.keys()))

    # Notify both players
    await broadcast(room, {
        "type": "matched",
        "opponent": room.player2.username if room.player2 else "Unknown",
        "opponent_for_p2": room.player1.username if room.player1 else "Unknown",
    })
    await broadcast(room, {
        "type": "building",
        "time_limit": BUILDING_TIME_LIMIT,
        "scenario": {
            "key": room.scenario_key,
            "name": SCENARIOS[room.scenario_key]["name"],
            "period": SCENARIOS[room.scenario_key]["period"],
            "description": SCENARIOS[room.scenario_key]["description"],
        },
    })


async def handle_submit_portfolio(room: BattleRoom, data: dict) -> None:
    """Handle portfolio submission from a player."""
    player_id = data.get("player_id", "")
    allocation = data.get("allocation", {})

    if room.player1 and room.player1.player_id == player_id:
        room.player1.portfolio = allocation
        room.player1.ready = True
        await send_to(room.player2, {"type": "opponent_ready"})
    elif room.player2 and room.player2.player_id == player_id:
        room.player2.portfolio = allocation
        room.player2.ready = True
        await send_to(room.player1, {"type": "opponent_ready"})

    # If both ready, start simulation
    if room.both_ready():
        await run_simulation(room)


async def run_simulation(room: BattleRoom) -> None:
    """Run the simulation and stream ticks to both players."""
    room.status = RoomStatus.SIMULATING

    scenario_key = room.scenario_key
    if not scenario_key or not room.player1 or not room.player2:
        return

    # Simulate both portfolios
    result1 = simulate_portfolio(room.player1.portfolio or {}, scenario_key)
    result2 = simulate_portfolio(room.player2.portfolio or {}, scenario_key)

    # Reveal scenario
    await broadcast(room, {
        "type": "scenario",
        "key": scenario_key,
        "name": SCENARIOS[scenario_key]["name"],
        "description": SCENARIOS[scenario_key]["description"],
    })

    await asyncio.sleep(1.0)

    # Stream ticks (one per month)
    months = result1["months"]
    for i in range(len(months)):
        await broadcast(room, {
            "type": "tick",
            "month": months[i],
            "index": i,
            "total": len(months),
            "p1_value": result1["values"][i],
            "p2_value": result2["values"][i],
        })
        if i < len(months) - 1:
            await asyncio.sleep(TICK_DELAY)

    # Compute winner
    score1 = compute_battle_score(result1, result2)
    score2 = compute_battle_score(result2, result1)

    winner_id = None
    if score1 > score2:
        winner_id = room.player1.player_id
    elif score2 > score1:
        winner_id = room.player2.player_id
    # else: tie

    room.status = RoomStatus.FINISHED
    room.results = {
        "winner_id": winner_id,
        "p1": {
            "player_id": room.player1.player_id,
            "username": room.player1.username,
            "portfolio": room.player1.portfolio,
            "final_value": result1["final_value"],
            "total_return": result1["total_return"],
            "sharpe_ratio": result1["sharpe_ratio"],
            "max_drawdown": result1["max_drawdown"],
            "score": score1,
            "values": result1["values"],
        },
        "p2": {
            "player_id": room.player2.player_id,
            "username": room.player2.username,
            "portfolio": room.player2.portfolio,
            "final_value": result2["final_value"],
            "total_return": result2["total_return"],
            "sharpe_ratio": result2["sharpe_ratio"],
            "max_drawdown": result2["max_drawdown"],
            "score": score2,
            "values": result2["values"],
        },
        "months": months,
        "scenario_key": scenario_key,
    }

    # Send results (AI insight will be fetched by frontend separately)
    await broadcast(room, {
        "type": "result",
        **room.results,
    })

    # Persist to database
    _save_battle_result(room)


def _save_battle_result(room: BattleRoom) -> None:
    """Persist battle result to Supabase (best-effort, never crashes the battle)."""
    try:
        import os
        if not (os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY")):
            return
        from db.database import create

        if not room.results or not room.player1 or not room.player2:
            return

        r = room.results
        p1 = r["p1"]
        p2 = r["p2"]
        now = datetime.now(timezone.utc).isoformat()

        # Save one row per player
        for player_data, opponent_data, is_winner in [
            (p1, p2, r["winner_id"] == p1["player_id"]),
            (p2, p1, r["winner_id"] == p2["player_id"]),
        ]:
            create("battle_results", {
                "room_id": room.room_id,
                "player_id": player_data["player_id"],
                "player_name": player_data["username"],
                "opponent_name": opponent_data["username"],
                "player_return": round(player_data["total_return"], 2),
                "opponent_return": round(opponent_data["total_return"], 2),
                "player_score": round(player_data["score"], 2),
                "won": is_winner,
                "scenario_key": r.get("scenario_key", ""),
                "portfolio": json.dumps(player_data.get("portfolio", {})),
                "played_at": now,
            })
    except Exception as e:
        print(f"[battle] Failed to save result to DB: {e}")


async def handle_ws_message(room: BattleRoom, ws: WebSocket, raw: str) -> None:
    """Route an incoming WebSocket message to the appropriate handler."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return

    msg_type = data.get("type", "")

    if msg_type == "join":
        await handle_join(room, ws, data)
    elif msg_type == "submit_portfolio":
        await handle_submit_portfolio(room, data)


async def handle_disconnect(room: BattleRoom, ws: WebSocket) -> None:
    """Handle a player disconnecting."""
    if room.player1 and room.player1.ws == ws:
        room.player1.ws = None
        await send_to(room.player2, {"type": "opponent_disconnected"})
    elif room.player2 and room.player2.ws == ws:
        room.player2.ws = None
        await send_to(room.player1, {"type": "opponent_disconnected"})
