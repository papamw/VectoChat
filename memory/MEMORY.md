# AppBv1 — Vector DB Generator

## Project overview
Full-stack web app to generate vector databases from domain-organized files.
- **Frontend**: React + Vite + Tailwind CSS — port 5173
- **Backend**: FastAPI (Python) — port 8000
- **Venv**: `/Users/papamamadouwade/AppBv1/venv/bin/python`

## Key constraints discovered
- Environment only has PyTorch 2.2.2 — must use `sentence-transformers==2.7.0` and `numpy<2`
- PyTorch 2.4+ not available via pip in this environment

## Architecture
```
AppBv1/
  backend/main.py          # FastAPI app
  backend/requirements.txt # pinned deps
  frontend/src/            # React components
  data/                    # domain folders with uploaded files
  vector_db/               # JSON vector stores per domain
  venv/                    # Python venv with all deps installed
  .claude/launch.json      # dev server configs
```

## API endpoints
- GET /domains — list all domains with file counts + VDB status
- POST /domain — create domain (form: name)
- DELETE /domain/{name} — delete domain + its VDB
- POST /upload — upload file (form: domain, file)
- DELETE /file — delete file (params: domain, filename)
- POST /generate-vector-db — build VDB from scratch (form: domain)
- POST /update-vector-db — incremental update (form: domain)
- POST /search — semantic search (form: domain, query, top_k)

## Start commands
```bash
# Backend
/Users/papamamadouwade/AppBv1/venv/bin/uvicorn main:app --reload --port 8000
# Frontend
cd /Users/papamamadouwade/AppBv1/frontend && npm run dev
```
Or use `.claude/launch.json` with the preview_start tool.
