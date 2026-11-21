# ASTRA SHIELD AI

Mission-control decision support that warns when an astronaut is at risk from **space radiation and sleep loss at the same time**, and re-plans the crew schedule around predicted radiation passes.

**Status:** under active development (hackathon build).

## Stack
React 18 + Vite + TypeScript + MUI + Tailwind · FastAPI · PostgreSQL 16 · Skyfield · Docker Compose

## Quick start
```bash
cp .env.example .env
docker compose up --build
# Dashboard: http://localhost:5173   API docs: http://localhost:8000/docs
```

## Honest limits
Prototype, **not a medical device**. Crew data is **simulated**. Risk formula weights are **design choices, not clinically validated**.

## Team
Allyna Khan (space systems) · Suheena Sameen (biomedical systems) · Kuhu Dhiman (product and integration)

Licensed under MIT.

## Run locally without Docker (Windows)
```powershell
cd backend
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
"DATABASE_URL=sqlite+aiosqlite:///./astra.db" | Out-File -Encoding utf8 .env
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m app.seed
.venv\Scripts\python -m uvicorn app.main:app --reload   # http://127.0.0.1:8000/docs
.venv\Scripts\python -m pytest -q
```
