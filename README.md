# MuleTrace

Intelligent mule-account detection and financial-fraud investigation platform (Cyber
Hackathon 2026, PS-01). React + TypeScript + Vite frontend at the repository root;
FastAPI + SQLAlchemy backend in `backend/` implementing the MULE DRISHTI SRS v1.2.

Frontend (deployed UI):
```bash
npm install && npm run dev     # local dev
npm run build                  # production build to dist/
npm test                       # 39 engine tests
```

---

## Backend (MULE DRISHTI SRS implementation)

A FastAPI + SQLAlchemy/Alembic backend implementing the SRS data foundation now lives in
`backend/`. The React app at the repository root is unchanged and remains the deployed UI;
wiring it to the API is Phase 5.

Local start (SQLite):
```bash
cd backend && pip install -r requirements.txt
DATABASE_URL=sqlite:///./data/muletrace.db alembic upgrade head
uvicorn app.main:app --reload
```
PostgreSQL (untested in build sandbox): `docker compose up db`, set `DATABASE_URL` per
`.env.example`, then the same `alembic upgrade head`.

Tests: `cd backend && python3 -m pytest tests/ -q` (13 passing as of 25 Oct 2026).
See `PROJECT_STATUS.md` for implemented/tested/incomplete status per SRS phase.

## One-command local setup (full platform)

Backend (Python 3.10+):
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # or use system python
pip install -r requirements.txt
alembic upgrade head                                  # creates/migrates the DB (SQLite default)
uvicorn app.main:app --reload                         # API on http://127.0.0.1:8000
```
Frontend (Node 18+), in the repo root:
```bash
npm install && npm run dev                            # UI on http://127.0.0.1:5173
```
The UI's "Platform (API)" section talks to the backend at `VITE_API_BASE`
(default `http://127.0.0.1:8000`). If the API is unreachable the screens say so
honestly - no mock data is substituted.

Core path: Workspace -> Insert Specific Dataset (import a historical CSV with a
`label` column as type "historical", and a current CSV as "current") -> Training
(train a model on the historical dataset) -> Analyse the current dataset ->
Dashboard / Money Trail / Findings -> PDF report.

PostgreSQL mode: `docker compose up -d db`, set `DATABASE_URL` in `.env` (see
`.env.example`), then `alembic upgrade head`. NOTE: the Postgres path is not yet
verified in CI; SQLite is the verified local mode with identical migrations.

Tests: `cd backend && python3 -m pytest tests/ -q` (23 tests) and `npm test` (39 tests).
