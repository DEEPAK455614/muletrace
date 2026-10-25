import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ApiError
from app.db.session import get_db
from app.models import Dataset
from app.schemas.datasets import ImportConfirm
from app.services import ingestion

router = APIRouter(prefix='/api/v1/datasets', tags=['datasets'])


@router.get('')
def list_datasets(db: Session = Depends(get_db)):
    rows = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    return {'datasets': [
        {'id': d.id, 'name': d.name, 'source_type': d.source_type, 'provenance': d.provenance,
         'checksum': d.checksum, 'schema_version': d.schema_version, 'currency': d.currency,
         'status': d.status, 'row_counts': json.loads(d.row_counts_json or '{}'),
         'created_at': d.created_at.isoformat() if d.created_at else None}
        for d in rows]}


@router.post('/validate')
async def validate(file: UploadFile = File(...)):
    if not (file.filename or '').lower().endswith('.csv'):
        raise ApiError(400, 'bad_extension', 'Only .csv files are accepted in this phase.')
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise ApiError(400, 'too_large', f'File exceeds the {settings.max_upload_bytes}-byte upload limit.')
    result = ingestion.validate_csv(content, max_rows=settings.max_csv_rows)
    result['file_name'] = file.filename
    return result


@router.post('/import')
async def confirm_import(file: UploadFile = File(...), payload: str = Form(...),
                         db: Session = Depends(get_db)):
    try:
        confirm = ImportConfirm.model_validate_json(payload)
    except ValueError as e:
        raise ApiError(422, 'bad_payload', 'Import confirmation payload is invalid.', {'detail': str(e)[:300]})
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise ApiError(400, 'too_large', f'File exceeds the {settings.max_upload_bytes}-byte upload limit.')
    try:
        result = ingestion.import_csv(db, content=content, file_name=confirm.file_name,
                                      mapping=confirm.mapping, source_type=confirm.source_type,
                                      name=confirm.name, currency=confirm.currency)
    except ValueError as e:
        raise ApiError(422, 'bad_mapping', str(e))
    return result


@router.get('/{dataset_id}')
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    d = db.get(Dataset, dataset_id)
    if not d:
        raise ApiError(404, 'not_found', 'Dataset not found.')
    return {'id': d.id, 'name': d.name, 'source_type': d.source_type, 'provenance': d.provenance,
            'checksum': d.checksum, 'schema_version': d.schema_version, 'currency': d.currency,
            'status': d.status, 'row_counts': json.loads(d.row_counts_json or '{}'),
            'created_at': d.created_at.isoformat() if d.created_at else None}
