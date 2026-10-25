"""Training + model registry endpoints (SRS section 8)."""
import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ModelVersion, TrainingRun
from app.schemas.runs import TrainingRequest
from app.services.training import start_training

router = APIRouter(tags=['training'])


def _run_view(r: TrainingRun) -> dict:
    return {'id': r.id, 'dataset_ids': json.loads(r.dataset_ids_json),
            'algorithm': r.algorithm, 'feature_version': r.feature_version,
            'parameters': json.loads(r.parameters_json or '{}'),
            'metrics': json.loads(r.metrics_json or '{}'),
            'status': r.status, 'created_at': r.created_at.isoformat()}


@router.get('/training-runs')
def list_training_runs(db: Session = Depends(get_db)):
    runs = db.execute(select(TrainingRun).order_by(TrainingRun.created_at.desc())).scalars().all()
    return {'training_runs': [_run_view(r) for r in runs]}


@router.post('/training-runs', status_code=201)
def create_training_run(req: TrainingRequest, db: Session = Depends(get_db)):
    run = start_training(db, dataset_ids=req.dataset_ids, algorithm=req.algorithm,
                         parameters=req.parameters)
    return _run_view(run)


@router.get('/training-runs/{run_id}')
def get_training_run(run_id: str, db: Session = Depends(get_db)):
    from app.core.errors import ApiError
    run = db.get(TrainingRun, run_id)
    if run is None:
        raise ApiError(404, 'run_not_found', 'Unknown training run id.')
    return _run_view(run)


@router.get('/models')
def list_models(db: Session = Depends(get_db)):
    models = db.execute(select(ModelVersion).order_by(ModelVersion.created_at.desc())).scalars().all()
    return {'models': [{'id': m.id, 'training_run_id': m.training_run_id,
                        'feature_version': m.feature_version, 'active': m.active,
                        'created_at': m.created_at.isoformat()} for m in models]}
