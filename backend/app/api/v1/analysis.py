"""Analysis run, graph, trace, findings, notes and report endpoints (SRS section 8)."""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.session import get_db
from app.models import AccountAssessment, AnalysisRun, AnalystNote, AuditEvent, Finding
from app.schemas.runs import AnalystNoteCreate, AnalysisRequest, FindingUpdate
from app.services import analysis as analysis_service
from app.services import graph as graph_service
from app.services import reporting

router = APIRouter(tags=['analysis'])


def _run_view(r: AnalysisRun) -> dict:
    return {'id': r.id, 'dataset_id': r.dataset_id, 'model_version_id': r.model_version_id,
            'status': r.status, 'started_at': r.started_at.isoformat(),
            'completed_at': r.completed_at.isoformat() if r.completed_at else None,
            'summary': json.loads(r.summary_json or '{}')}


def _parse_dt(raw: str | None, field: str) -> datetime | None:
    if raw is None:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        raise ApiError(422, 'invalid_datetime', f'"{field}" must be an ISO-8601 datetime.')


@router.get('/analysis-runs')
def list_runs(db: Session = Depends(get_db)):
    runs = db.execute(select(AnalysisRun).order_by(AnalysisRun.started_at.desc())).scalars().all()
    return {'analysis_runs': [_run_view(r) for r in runs]}


@router.post('/analysis-runs', status_code=201)
def create_run(req: AnalysisRequest, db: Session = Depends(get_db)):
    run = analysis_service.start_analysis(
        db, dataset_id=req.dataset_id, model_version_id=req.model_version_id,
        rule_thresholds=req.rule_thresholds)
    return _run_view(run)


@router.get('/analysis-runs/{run_id}')
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.get(AnalysisRun, run_id)
    if run is None:
        raise ApiError(404, 'run_not_found', 'Unknown analysis run id.')
    return _run_view(run)


@router.get('/analysis-runs/{run_id}/assessments')
def list_assessments(run_id: str, db: Session = Depends(get_db),
                     band: str | None = Query(default=None),
                     limit: int = Query(default=50, ge=1, le=500),
                     offset: int = Query(default=0, ge=0)):
    if db.get(AnalysisRun, run_id) is None:
        raise ApiError(404, 'run_not_found', 'Unknown analysis run id.')
    q = select(AccountAssessment).where(AccountAssessment.analysis_run_id == run_id)
    if band:
        q = q.where(AccountAssessment.band == band)
    q = q.order_by(AccountAssessment.score.desc()).limit(limit).offset(offset)
    rows = db.execute(q).scalars().all()
    from app.models import Account
    items = []
    for a in rows:
        acct = db.get(Account, a.account_id)
        items.append({'account_ref': acct.external_account_ref if acct else a.account_id,
                      'account_id': a.account_id, 'score': float(a.score), 'band': a.band,
                      'method': a.method,
                      'indicators': json.loads(a.indicators_json or '{}'),
                      'warnings': json.loads(a.warnings_json or '[]')})
    return {'run_id': run_id, 'count': len(items), 'limit': limit, 'offset': offset,
            'assessments': items}


@router.get('/analysis-runs/{run_id}/graph')
def get_graph(run_id: str, db: Session = Depends(get_db),
              min_amount: float | None = None, since: str | None = None,
              until: str | None = None, limit: int = Query(default=500, ge=1, le=500)):
    return graph_service.run_graph(db, run_id, min_amount=min_amount,
                                   since=_parse_dt(since, 'since'),
                                   until=_parse_dt(until, 'until'), limit=limit)


@router.get('/analysis-runs/{run_id}/trace')
def get_trace(run_id: str, account_ref: str, direction: str = 'forward',
              max_hops: int = 3, min_amount: float | None = None,
              since: str | None = None, until: str | None = None,
              db: Session = Depends(get_db)):
    if direction not in ('forward', 'backward'):
        raise ApiError(422, 'invalid_direction', 'direction must be forward or backward.')
    return graph_service.trace(db, run_id, account_ref=account_ref, direction=direction,
                               max_hops=max_hops, min_amount=min_amount,
                               since=_parse_dt(since, 'since'), until=_parse_dt(until, 'until'))


@router.get('/analysis-runs/{run_id}/accounts/{account_id}')
def get_account(run_id: str, account_id: str, db: Session = Depends(get_db)):
    return graph_service.account_detail(db, run_id, account_id)


@router.get('/analysis-runs/{run_id}/findings')
def list_findings(run_id: str, db: Session = Depends(get_db),
                  status: str | None = None, limit: int = Query(default=100, ge=1, le=500),
                  offset: int = Query(default=0, ge=0)):
    if db.get(AnalysisRun, run_id) is None:
        raise ApiError(404, 'run_not_found', 'Unknown analysis run id.')
    q = select(Finding).where(Finding.analysis_run_id == run_id)
    if status:
        q = q.where(Finding.status == status)
    rows = db.execute(q.order_by(Finding.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    return {'run_id': run_id, 'count': len(rows), 'findings': [
        {'id': f.id, 'type': f.type, 'severity': f.severity, 'title': f.title,
         'explanation': f.explanation, 'status': f.status,
         'evidence': json.loads(f.evidence_refs_json or '{}'),
         'created_at': f.created_at.isoformat()} for f in rows]}


@router.patch('/findings/{finding_id}')
def update_finding(finding_id: str, req: FindingUpdate, db: Session = Depends(get_db)):
    f = db.get(Finding, finding_id)
    if f is None:
        raise ApiError(404, 'finding_not_found', 'Unknown finding id.')
    if req.status not in ('open', 'acknowledged', 'resolved'):
        raise ApiError(422, 'invalid_status', 'status must be open, acknowledged or resolved.')
    f.status = req.status
    import uuid
    db.add(AuditEvent(id=str(uuid.uuid4()), actor_ref='local-session',
                      action='finding_status_changed', target_type='finding', target_id=f.id,
                      metadata_json=json.dumps({'status': req.status})))
    db.commit()
    return {'id': f.id, 'status': f.status}


@router.post('/findings/{finding_id}/notes', status_code=201)
def add_note(finding_id: str, req: AnalystNoteCreate, db: Session = Depends(get_db)):
    if db.get(Finding, finding_id) is None:
        raise ApiError(404, 'finding_not_found', 'Unknown finding id.')
    import uuid
    note = AnalystNote(id=str(uuid.uuid4()), finding_id=finding_id, note=req.note)
    db.add(note)
    db.commit()
    return {'id': note.id, 'finding_id': finding_id, 'created_at': note.created_at.isoformat()}


@router.get('/analysis-runs/{run_id}/report.pdf')
def get_report(run_id: str, db: Session = Depends(get_db)):
    path = reporting.generate_report(db, run_id)
    return FileResponse(str(path), media_type='application/pdf',
                        filename=f'investigation-report-{run_id[:8]}.pdf')
