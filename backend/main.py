from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic
import time
import os

from db.database import create, read, update, delete

load_dotenv()

for key in ["ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"]:
    if not os.getenv(key):
        raise RuntimeError(f"Missing required env var: {key}")

app = FastAPI(title="Cache Me If You Can", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8501"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_client = anthropic.Anthropic()

@app.middleware("http")
async def log_request(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000)
    print(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response

@app.get("/")
def root():
    return {"status": "ok", "project": "Cache Me If You Can"}

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

#CRUD endpoints
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
    

#File upload

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "path": path}
