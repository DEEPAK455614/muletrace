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
