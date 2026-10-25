# Suraag

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
`.env.example`), then `alembic upgrade head`. Embedded PostgreSQL16.2 runtime was verified in the 25 October QA; docker-compose itself was not exercised in the sandbox.

Tests: `cd backend && python3 -m pytest tests/ -q` (25 tests) and `npm test` (39 tests).

## Short demo

See `video/suraag-r1/README.md`. The short private review video distinguishes the persisted backend workspace from the separate browser-demo workbench.
