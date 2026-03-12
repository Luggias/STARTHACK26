# Cache Me If You Can 🏆
**START Hack 2026** · 18–20 March 2026 · OLMA Messen, St. Gallen

> Team: Constantin Salzer · Lukas Kapferer · Jamie Maier · Dorian Markies

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend / API | Python · FastAPI |
| Frontend | Python · Streamlit |
| Database | Supabase (PostgreSQL) |
| AI | Anthropic Claude API · OpenAI API |
| Deployment | Vercel (Frontend) · Railway (Backend) |

---

## Setup — Clone & Run in < 5 minutes

### 1. Clone the repo
```bash
git clone https://github.com/Luggias/STARTHACK26.git
cd STARTHACK26
```

### 2. Create Python environment
```bash
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows (PowerShell)
.\venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
```bash
cp .env.example .env
# Open .env and fill in your API keys
```

### 5. Run the backend
```bash
uvicorn backend.main:app --reload
```
API is now live at `http://localhost:8000` · Docs at `http://localhost:8000/docs`

### 6. Run the frontend
```bash
streamlit run frontend/app.py
```
UI opens automatically at `http://localhost:8501`

---

## Project Structure

```
STARTHACK26/
├── backend/
│   └── main.py          # FastAPI app & API routes
├── frontend/
│   └── app.py           # UI (Streamlit or Next.js)
├── db/
│   └── database.py      # DB connection & models
├── ai-exercises/        # Local API practice scripts (gitignored)
├── .env.example         # API key template
├── requirements.txt
└── README.md
```

---

## Team Roles

| Person | Role |
|--------|------|
| Constantin | Lead Engineer · Backend · API Architecture |
| Lukas | ML / Data Lead · Integration |
| Jamie | Quant Analytics · Frontend · Data Visualization |
| Dorian | Business Strategy · Pitch (Primary Speaker) |

---

## Required API Keys

Add these to your `.env` file (get them before the hackathon!):

```
ANTHROPIC_API_KEY=...     # console.anthropic.com
OPENAI_API_KEY=...        # platform.openai.com
SUPABASE_URL=...          # supabase.com
SUPABASE_KEY=...          # supabase.com
```

---

## Deployment Checklist

Use this during the hackathon to go from local to live in ~30 minutes:

- [ ] Backend → **Railway**: connect GitHub repo, set env vars, deploy
- [ ] Frontend → **Railway**: deploy Streamlit app alongside backend
- [ ] Database → **Supabase**: create project, run schema, copy URL + key to env
- [ ] Smoke test: hit all critical API endpoints, verify DB reads/writes
- [ ] Record backup demo video with Loom (in case live demo crashes)

---

## Hackathon Quick Reference

- **Submission deadline:** Friday 08:00 — submit by 07:30!
- **Public voting window:** Friday 14:30–14:40 (10 minutes only!)
- **Pitch format:** Problem (20s) → Live Demo (90s) → Business Impact (30s) → Team (10s)
- **Code freeze:** T+30h — no new features after that, bugs & UX only
