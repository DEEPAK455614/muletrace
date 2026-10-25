"""Evidence-linked PDF report generation (SRS FR-08).

Reports are rendered ONLY from persisted analysis-run results. Empty sections
state "No matching evidence found" - never placeholder content. Every figure
traces to stored run/assessment/finding records.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ApiError
from app.models import (Account, AccountAssessment, AnalysisRun, AuditEvent,
                        Dataset, Finding, ModelVersion)


def generate_report(db: Session, run_id: str, actor_ref: str = 'local-session') -> Path:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    run = db.get(AnalysisRun, run_id)
    if run is None:
        raise ApiError(404, 'run_not_found', 'Unknown analysis run id.')
    if run.status != 'completed':
        raise ApiError(409, 'run_incomplete', 'Report requires a completed analysis run.')
    dataset = db.get(Dataset, run.dataset_id)
    mv = db.get(ModelVersion, run.model_version_id) if run.model_version_id else None
    summary = json.loads(run.summary_json or '{}')
    assessments = db.execute(
        select(AccountAssessment).where(AccountAssessment.analysis_run_id == run_id)
        .order_by(AccountAssessment.score.desc())).scalars().all()
    findings = db.execute(
        select(Finding).where(Finding.analysis_run_id == run_id)).scalars().all()
    accounts = {a.id: a for a in db.execute(
        select(Account).where(Account.dataset_id == run.dataset_id)).scalars().all()}

    out_dir = Path(settings.reports_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f'report-{run_id}.pdf'

    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 20 * mm

    def line(text: str, size: int = 10, dy: float = 6.0) -> None:
        nonlocal y
        if y < 20 * mm:
            c.showPage()
            y = height - 20 * mm
        c.setFont('Helvetica', size)
        c.drawString(20 * mm, y, text[:160])
        y -= dy * mm

    line('MuleTrace Investigation Report', 16, 10)
    line('Investigative leads for human review - not automated legal conclusions.', 10, 8)
    line(f'Analysis run: {run.id}')
    line(f'Dataset: {dataset.name if dataset else run.dataset_id}  (checksum {dataset.checksum[:16]}...)' if dataset else '')
    line(f'Dataset provenance: {dataset.provenance if dataset else "unknown"}; source type: {dataset.source_type if dataset else "unknown"}')
    line(f'Model version: {mv.id if mv else "none - rule-based baseline"}; method: {summary.get("method", "unknown")}')
    line(f'Run completed: {run.completed_at.isoformat() if run.completed_at else "n/a"}; '
         f'scoring {summary.get("scoring_version", "?")}, rules {summary.get("rules_version", "?")}', 10, 10)

    line('Key metrics', 13, 8)
    line(f'Accounts analysed: {summary.get("accounts_analysed", 0)}')
    line(f'Band distribution: {json.dumps(summary.get("band_distribution", {}))}')
    line(f'Findings created: {summary.get("findings_created", 0)}', 10, 10)

    line('Flagged accounts (top by triage score)', 13, 8)
    shown = 0
    for a in assessments:
        if a.band in ('high', 'critical') and shown < 15:
            ref = accounts[a.account_id].external_account_ref if a.account_id in accounts else a.account_id
            line(f'  {ref}: score {float(a.score):.1f} [{a.band}] via {a.method}')
            shown += 1
    if shown == 0:
        line('  No matching evidence found.', 10, 10)

    y -= 4 * mm
    line('Findings and evidence', 13, 8)
    if not findings:
        line('  No matching evidence found.', 10, 10)
    for f in findings[:20]:
        ev = json.loads(f.evidence_refs_json or '{}')
        txn_refs = ev.get('txn_refs', [])[:5]
        line(f'  [{f.severity}] {f.title}')
        line(f'    {f.explanation[:140]}')
        line(f'    Evidence txns: {", ".join(txn_refs) if txn_refs else "none recorded"}')

    y -= 4 * mm
    line('Caveats and data-quality limitations', 13, 8)
    for lim in summary.get('limitations', ['none recorded']):
        line(f'  - {lim}')
    line('Scores are triage signals computed from imported records; uncalibrated model outputs are '
         'not fraud probabilities.', 9)
    line('Money-trail paths are hypotheses over observed transactions; amounts are not '
         'conserved-principal reconstructions.', 9, 10)
    c.save()

    db.add(AuditEvent(id=str(uuid.uuid4()), actor_ref=actor_ref, action='report_generated',
                      target_type='analysis_run', target_id=run_id,
                      metadata_json=json.dumps({'report': path.name})))
    db.commit()
    return path
