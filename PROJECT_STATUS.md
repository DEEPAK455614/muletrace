# PROJECT STATUS - MuleTrace (MULE DRISHTI SRS v1.2 implementation)

Updated: 25 Oct 2026, after Phase 0 + Phase 1. Source of truth for what is real.

## Layout decision (documented exception, SRS section 9 allows it)
The existing React + TypeScript + Vite frontend stays at the REPOSITORY ROOT (not `frontend/`):
it is a working, deployed component (Cloudflare Pages builds from root). The SRS-prescribed
`backend/` (FastAPI) is added alongside. All other SRS folder conventions are followed
(`data/`, `artifacts/`, `reports/`, `scripts/`, docker-compose.yml, .env.example).

## Phase 0 - Repository bootstrap: DONE
- `backend/` FastAPI skeleton: config (env-driven, .env.example committed), consistent JSON
  errors (no stack traces/paths/secrets), `/health` reporting database status.
- SQLAlchemy 2 + Alembic; migration `0001_initial` creates all 11 SRS logical tables
  (datasets, import_batches, accounts, transactions, training_runs, model_versions,
  analysis_runs, account_assessments, findings, analyst_notes, audit_events).
- docker-compose.yml for PostgreSQL 16. NOTE: Docker is unavailable in the build sandbox, so
  the compose file is UNTESTED; migrations and tests were verified against SQLite locally.
  Postgres verification remains open (Phase 6 local-setup check).

## Phase 1 - Data foundation: DONE (tested)
- Dataset registry + import batches with file SHA-256 checksums, original headers, column
  mapping, import timestamps, accepted/rejected/duplicate counts, status.
- Portal-aligned CSV validation: alias suggestion (Transaction ID/UTR, Transaction Date/Time,
  Fraud Amount, debit/credit bank-wallet-merchant, debit/credit account IDs), required-field
  errors, malformed timestamp/amount rejection, UTF-8/extension/size/row-limit guards,
  honest warning when recipient column absent (tracing limited, never invented).
- Import is confirm-only, never overwrites prior datasets; one dataset per import; duplicate
  policy = external txn ref scoped to dataset, else composite fingerprint - duplicates are
  FLAGGED (duplicate_of) and counted, never silently dropped. Source row numbers preserved
  (raw_row_ref). Money stored as NUMERIC(19,4); timestamps UTC.
- Audit events recorded for imports with actor_ref `local-session` (auth deferred per SRS).
- API: GET /health, GET /api/v1/datasets, POST /api/v1/datasets/validate,
  POST /api/v1/datasets/import, GET /api/v1/datasets/{id}. Versioned /api/v1 prefix.

## Tests: 13/13 passing (backend/tests, pytest)
CSV accept/reject, missing-column errors, recipient warning, non-UTF8 rejection, import
counts + reject reasons + source-row traceability, duplicate flag-not-delete, no-overwrite,
account derivation, bad-mapping rejection, health, validate/import/list/get API flows.

## Not yet implemented (SRS phases)
- Phase 2 historical training + model versioning (scikit-learn).
- Phase 3 current analysis runs + persisted assessments.
- Phase 4 graph/tracing + findings.
- Phase 5 frontend wiring to API, dashboard, money-trail UI, PDF reports, theme toggle.
- Phase 6 end-to-end verification, docker/Postgres local-setup check.

## Known risks / honest limits
- docker-compose Postgres path unverified in sandbox (SQLite verified).
- Frontend is still the browser-side engine build; it is NOT yet wired to the backend API.
  The two pipelines coexist until Phase 5; the UI does not yet read API datasets.
- Naive CSV timestamps are treated as UTC; the assumption is recorded in code, not yet
  surfaced in the validation response.
