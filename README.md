# Cache Me If You Can

**START Hack 2026** · 18–20 March 2026 · OLMA Messen, St. Gallen

> Team: Constantin Salzer · Lukas Kapferer · Jamie Maier · Dorian Markies

A gamified financial education platform where players learn investing by building portfolios and battling 1v1 through real historical market crises.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python · FastAPI · Uvicorn |
| Frontend | TypeScript · Next.js · Tailwind CSS · Framer Motion |
| State | Zustand |
| Charts | TradingView Lightweight Charts |
| Real-time | FastAPI WebSockets |
| AI | Anthropic Claude API |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel (frontend) · Railway (backend) |

---

## Setup

### 1. Clone

```bash
git clone https://github.com/Luggias/STARTHACK26.git
cd STARTHACK26
```

### 2. Backend

```bash
python -m venv venv
source venv/bin/activate        # Windows: .\venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # fill in your API keys

uvicorn backend.main:app --reload
# API: http://localhost:8000  |  Docs: http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # if exists, else create manually
npm install
npm run dev
# UI: http://localhost:3000
```

### Frontend env vars (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Environment Variables

Add to `.env` (see `.env.example`):

```
ANTHROPIC_API_KEY=...     # console.anthropic.com
SUPABASE_URL=...          # supabase.com → project settings → API
SUPABASE_KEY=...          # supabase.com → project settings → API
FRONTEND_URL=http://localhost:3000
```

---

## Project Structure

```
STARTHACK26/
├── backend/
│   ├── main.py              # FastAPI routes, WebSocket, AI endpoints, CORS
│   ├── battle.py            # Battle room state machine (WAITING → BUILDING → SIMULATING → FINISHED)
│   └── data/
│       └── historical.py    # Asset definitions, 4 historical scenarios, simulate_portfolio()
├── frontend/
│   └── src/
│       ├── app/             # Pages: / (landing), /sandbox, /battle, /battle/[roomId]
│       ├── components/      # asset-card, portfolio-builder, performance-chart, ai-insight, ...
│       ├── lib/             # api.ts, ws.ts, types.ts, constants.ts
│       └── store/           # Zustand game store (player + allocation)
├── db/
│   └── database.py          # Supabase client
├── .env.example
└── requirements.txt
```

---

## Game Flow

```
Landing Page  →  Sandbox Mode  →  Battle Mode
     |                |                |
 Username         Learn 5 asset    Real-time 1v1
 entry            classes, build   60s to allocate,
                  & simulate       live chart battle,
                  portfolios       AI insight after
```

**Scoring:** 60% return · 30% Sharpe ratio · 10% diversification

**Historical Scenarios:** 2008 Financial Crisis · COVID Crash & Recovery · Dot-Com Bubble · 2022 Inflation Surge

---

## Team

| Person | Role |
|--------|------|
| Constantin | Lead Engineer · Backend · API Architecture |
| Lukas | ML / Data Lead · Integration |
| Jamie | Quant Analytics · Frontend · Data Visualization |
| Dorian | Business Strategy · Pitch |
