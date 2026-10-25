# PROJECT_STATUS — MULE DRISHTI SRS implementation

Updated: 25 Oct 2026 (after Phases 0–4 backend + Phase 5 backend reporting). Source of truth
for what is implemented, tested, incomplete, and at risk. SRS: MULE DRISHTI v1.2 (25 Oct 2026).

## Layout exception (documented per SRS section 9)
The pre-existing React + TypeScript + Vite frontend remains at the repository root because it is
the working, deployed component. The FastAPI backend lives in `backend/` per the SRS layout.
Data/artifact/report directories exist at repo root: `data/{historical,incoming,processed}`,
`artifacts/`, `reports/` (gitignored content; README committed).

## Phase status

### Phase 0 — Repository bootstrap: IMPLEMENTED + TESTED
- `backend/` FastAPI skeleton: env config (`app/core/config.py`, `.env.example` only), consistent
  JSON errors (no stack traces/paths), `/health` with DB status, SQLAlchemy 2 + Alembic,
  migration `0001_initial` creating all 11 SRS tables.
- docker-compose.yml for PostgreSQL 16. NOT TESTED (no Docker in this environment) — known risk.
- SQLite mode verified with the same migration. Postgres runtime verification is UNRESOLVED and
  must be checked on an environment with Docker before any claim of Postgres support.

### Phase 1 — Data foundation: IMPLEMENTED + TESTED
- Portal-aligned CSV validation (alias mapping, required-field checks, malformed
  timestamp/amount rejection, UTF-8/extension/size/row guards, honest missing-recipient warning).
- Confirm-only import; never overwrites prior datasets. Dataset registry + import batches,
  SHA-256 checksums, original headers, source row numbers (`raw_row_ref`), accepted/rejected/
  duplicate counts, flag-not-delete duplicate policy (external ref per dataset, else documented
  composite fingerprint), NUMERIC(19,4) money, UTC timestamps, audit events.
- API: `GET /health`, `GET/POST /api/v1/datasets` (`validate`, `import`, `{id}`).
- Tests: ingestion + API coverage in `backend/tests/test_ingestion.py`, `test_api.py`.

### Phase 2 — Historical training: IMPLEMENTED + TESTED
- `services/training.py`: explicit training action on `historical` datasets only (current
  datasets rejected); label detection from the trusted historical file (checksum-matched in
  `data/historical/`); deterministic stratified 60/20/20 train/dev/holdout split (fixed seed 42);
  preprocessing fit on the training split only; Logistic Regression (default) or Random Forest;
  unsupervised IsolationForest fallback explicitly labelled as anomaly-score-only; insufficient/
  malformed data stops with an actionable error (no fake model).
- Dev and holdout metrics reported separately (precision, recall, F1, confusion, PR-AUC where
  meaningful); holdout evaluated once, never tuned. Reproducibility test: identical holdout
  metrics across repeated runs.
- Versioned artifacts under `artifacts/<model_version_id>/` (joblib pipeline + metadata.json with
  library versions, feature schema, dataset checksums); a model version is activated only after
  an artifact round-trip validation succeeds.
- API: `GET/POST /api/v1/training-runs`, `GET /api/v1/training-runs/{id}`, `GET /api/v1/models`.

### Phase 3 — Current analysis: IMPLEMENTED + TESTED
- `services/analysis.py`: one current dataset + one compatible model version per run; feature
  schema mismatch rejected (409); never retrains implicitly; rule-based baseline explicitly
  labelled when no model is available.
- Documented scoring strategy `scoring-v1`: 0.6*model + 0.4*rule_fraction (baseline:
  rule_fraction only); bands low/medium/high/critical as triage levels; score clamped < 100.
- Persisted `account_assessments` with features, triggered rules + evidence txn refs, model
  output, data-quality warnings (incl. uncalibrated-model disclosure).
- API: `GET/POST /api/v1/analysis-runs`, `GET .../assessments` (paginated, band filter).
- Verified: analysis does not change the active model version.

### Phase 4 — Investigation: IMPLEMENTED + TESTED
- `services/graph.py`: edges built only from stored transactions; bounded graph slice
  (min-amount/time filters, hard edge cap, honest empty state); forward/backward temporal BFS
  with hop limit (1–10), path cap, ISO/naive-UTC datetime normalisation; account drill-down with
  assessment + related transactions.
- Findings generated from deterministic rules with severity, reason, evidence refs; PATCH
  acknowledge/resolve + analyst notes; audit events on state changes.
- API: `GET .../graph`, `GET .../trace`, `GET .../accounts/{id}`, `GET .../findings`,
  `PATCH /api/v1/findings/{id}`, `POST /api/v1/findings/{id}/notes`.
- Verified: graph edges correspond exactly to stored transactions; changing source records
  changes results; hop and time limits respected.

### Phase 5 — UX/reporting: PARTIAL
- Backend report: `services/reporting.py` renders an evidence-linked PDF via ReportLab from
  persisted run results only ("No matching evidence found" for empty sections);
  `GET /api/v1/analysis-runs/{id}/report.pdf`. TESTED.
- Frontend wiring to the backend API (workspace, upload wizard, training, dashboard, graph,
  findings, report download) and the FR-10 Light/Dark/System theme selector: IN PROGRESS.
  The existing root frontend remains the synthetic-scenario workbench and is unchanged.

### Phase 6 — Verification: PENDING
- E2E labelled-synthetic walkthrough, hardcoded-value sweep, fresh-clone setup check, final
  PROJECT_STATUS reconciliation.

## Test totals
- Backend: 23/23 pytest passing (13 Phase 0–1 + 8 Phase 2–4 services + 2 API flow).
- Frontend: 39/39 Vitest passing (unchanged existing engine).

## Known risks / unresolved
1. PostgreSQL + docker-compose runtime NOT verified (no Docker available here). SQLite verified
   with identical migrations. UNRESOLVED until checked on a Docker-capable environment.
2. Naive CSV timestamps are assumed UTC (recorded in code); display-timezone localisation pending.
3. Frontend is not yet wired to the backend (Phase 5 in progress).
4. Model outputs are uncalibrated by design of the current pipeline; disclosed in every
   assessment warning. No calibration implemented — scores must not be quoted as probabilities.
