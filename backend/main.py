from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic
import os

load_dotenv()

app = FastAPI(title="Cache Me If You Can", version="0.1.0")

# Allow Streamlit frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8501"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_client = anthropic.Anthropic()


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "project": "Cache Me If You Can"}


# ── Example: Claude AI endpoint ──────────────────────────────────────────────

class PromptRequest(BaseModel):
    message: str
    system: str = "You are a helpful assistant."

@app.post("/ai/chat")
def chat(req: PromptRequest):
    response = ai_client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        system=req.system,
        messages=[{"role": "user", "content": req.message}]
    )
    return {"reply": response.content[0].text}


# ── Add your own endpoints below ─────────────────────────────────────────────
