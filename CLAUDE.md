# CLAUDE.md — Project Context for AI Assistants

## Project
**Cache Me If You Can** — START Hack 2026
Team: Constantin Salzer · Lukas Kapferer · Jamie Maier · Dorian Markies

## Tech Stack
- **Backend:** Python · FastAPI (`backend/main.py`) — run with `uvicorn backend.main:app --reload`
- **Frontend:** Python · Streamlit (`frontend/app.py`) — run with `streamlit run frontend/app.py`
- **Database:** Supabase (PostgreSQL) — client in `db/database.py`
- **AI:** Anthropic Claude API · OpenAI API
- **Deployment:** Railway (backend + frontend) · Supabase (DB)

## Project Structure
```
STARTHACK26/
├── backend/main.py      # FastAPI routes & Claude API calls
├── frontend/app.py      # Streamlit UI
├── db/database.py       # Supabase client (import db from here)
├── .env                 # API keys — never commit!
├── .env.example         # Key template
└── requirements.txt
```

## Environment Variables
All keys live in `.env` (see `.env.example`):
- `ANTHROPIC_API_KEY` — console.anthropic.com
- `OPENAI_API_KEY` — platform.openai.com
- `SUPABASE_URL` / `SUPABASE_KEY` — supabase.com → project settings → API

## Team Roles
- **Constantin** — Lead Engineer · Backend · API Architecture
- **Lukas** — ML / Data Lead · Integration
- **Jamie** — Quant Analytics · Frontend · Data Visualization
- **Dorian** — Business Strategy · Pitch

## Coding Standards
Follow `AGENTS.md` for commit format and code style:
- Commit format: `[type|scope] short description` (e.g. `[feat|api] add claude endpoint`)
- English only — all code, comments, variable names
- KISS principle — simple and direct, no over-engineering
- No hardcoded secrets — always use environment variables
