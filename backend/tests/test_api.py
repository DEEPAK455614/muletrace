"""API-level tests: health, validate, import, dataset registry (SRS section 8)."""
import io
import json
import os

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app import models  # noqa: F401

from conftest import MAPPING, VALID_CSV


@pytest.fixture()
def client():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['database'] is True


def test_validate_endpoint(client):
    r = client.post('/api/v1/datasets/validate',
                    files={'file': ('sample.csv', io.BytesIO(VALID_CSV), 'text/csv')})
    assert r.status_code == 200
    body = r.json()
    assert body['valid'] is True and body['row_count'] == 3


def test_validate_rejects_non_csv(client):
    r = client.post('/api/v1/datasets/validate',
                    files={'file': ('x.txt', io.BytesIO(b'hi'), 'text/plain')})
    assert r.status_code == 400
    assert r.json()['error']['code'] == 'bad_extension'


def test_import_then_list_and_get(client):
    payload = {'file_name': 'sample.csv', 'mapping': MAPPING, 'source_type': 'current',
               'name': 'Oct investigation set', 'currency': 'INR'}
    r = client.post('/api/v1/datasets/import',
                    files={'file': ('sample.csv', io.BytesIO(VALID_CSV), 'text/csv')},
                    data={'payload': json.dumps(payload)})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out['accepted'] == 3 and out['rejected'] == 0

    lst = client.get('/api/v1/datasets').json()['datasets']
    assert len(lst) == 1 and lst[0]['name'] == 'Oct investigation set'
    got = client.get(f"/api/v1/datasets/{out['dataset_id']}")
    assert got.status_code == 200 and got.json()['row_counts']['accepted'] == 3
    assert client.get('/api/v1/datasets/nope').status_code == 404
