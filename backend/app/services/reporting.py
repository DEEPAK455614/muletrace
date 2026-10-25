"""Evidence-linked PDF report generation (SRS FR-08).

Reports are rendered ONLY from persisted analysis-run results. Empty sections
state "No matching evidence found" - never placeholder content. Every figure
traces to stored run/assessment/finding records.

All prose is wrapped to the printable width (measured with the real font
metrics, not character counts) so no line can run past the right margin, and
pages break before the bottom margin. Long unbroken tokens (ids, checksums)
are hard-split.
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

FONT = 'Helvetica'


def wrap_text(text: str, size: float, max_width: float) -> list[str]:
    """Wrap text to max_width points using real font metrics. Splits overlong words."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    def split_word(word: str) -> list[str]:
        parts, cur = [], ''
        for ch in word:
            if stringWidth(cur + ch, FONT, size) > max_width and cur:
                parts.append(cur)
                cur = ch
            else:
                cur += ch
        if cur:
            parts.append(cur)
        return parts

    lines: list[str] = []
    for raw in text.split('\n'):
        cur = ''
        for word in raw.split():
            for piece in split_word(word):
                trial = f'{cur} {piece}'.strip()
                if stringWidth(trial, FONT, size) <= max_width:
                    cur = trial
                else:
                    if cur:
                        lines.append(cur)
                    cur = piece
        lines.append(cur)
    return lines


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
    left = 20 * mm
    top = height - 20 * mm
    bottom = 20 * mm
    max_w = width - 2 * left
    y = top

    def para(text: str, size: float = 10, dy: float = 5.2, indent: float = 0.0,
             gap_after: float = 0.0) -> None:
        nonlocal y
        for ln in wrap_text(text, size, max_w - indent):
            if y < bottom:
                c.showPage()
                y = top
            c.setFont(FONT, size)
            c.drawString(left + indent, y, ln)
            y -= dy * mm
        y -= gap_after * mm

    para('Suraag Investigation Report', 16, 7.5, gap_after=3)
    para('Investigative leads for human review - not automated legal conclusions.', 10, gap_after=2)
    para(f'Analysis run: {run.id}')
    if dataset:
        para(f'Dataset: {dataset.name}  (checksum {dataset.checksum[:16]}...)')
        para(f'Dataset provenance: {dataset.provenance}; source type: {dataset.source_type}')
    para(f'Model version: {mv.id if mv else "none - rule-based baseline"}; method: {summary.get("method", "unknown")}')
    para(f'Run completed: {run.completed_at.isoformat() if run.completed_at else "n/a"}; '
         f'scoring {summary.get("scoring_version", "?")}, rules {summary.get("rules_version", "?")}', gap_after=4)

    para('Key metrics', 13, 6.5, gap_after=1.5)
    para(f'Accounts analysed: {summary.get("accounts_analysed", 0)}')
    para(f'Band distribution: {json.dumps(summary.get("band_distribution", {}))}')
    para(f'Findings created: {summary.get("findings_created", 0)}', gap_after=4)

    para('Flagged accounts (top by triage score)', 13, 6.5, gap_after=1.5)
    shown = 0
    for a in assessments:
        if a.band in ('high', 'critical') and shown < 15:
            ref = accounts[a.account_id].external_account_ref if a.account_id in accounts else a.account_id
            para(f'{ref}: score {float(a.score):.1f} [{a.band}] via {a.method}', indent=4 * mm)
            shown += 1
    if shown == 0:
        para('No matching evidence found.', indent=4 * mm, gap_after=4)
    else:
        y -= 4 * mm

    para('Findings and evidence', 13, 6.5, gap_after=1.5)
    if not findings:
        para('No matching evidence found.', indent=4 * mm, gap_after=4)
    for f in findings[:20]:
        ev = json.loads(f.evidence_refs_json or '{}')
        txn_refs = ev.get('txn_refs', [])[:5]
        para(f'[{f.severity}] {f.title}', indent=4 * mm)
        para(f.explanation, indent=8 * mm)
        para(f'Evidence txns: {", ".join(txn_refs) if txn_refs else "none recorded"}', indent=8 * mm, gap_after=2)

    para('Caveats and data-quality limitations', 13, 6.5, gap_after=1.5)
    for lim in summary.get('limitations', ['none recorded']):
        para(f'- {lim}', indent=4 * mm)
    para('Scores are triage signals computed from imported records; uncalibrated model outputs are '
         'not fraud probabilities.', 9, gap_after=0.5)
    para('Money-trail paths are hypotheses over observed transactions; amounts are not '
         'conserved-principal reconstructions.', 9)
    c.save()

    db.add(AuditEvent(id=str(uuid.uuid4()), actor_ref=actor_ref, action='report_generated',
                      target_type='analysis_run', target_id=run_id,
                      metadata_json=json.dumps({'report': path.name})))
    db.commit()
    return path
