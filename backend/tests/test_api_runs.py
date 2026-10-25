"""API tests for training/analysis/graph/findings/report endpoints (SRS section 8)."""
import csv
import io
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app import models  # noqa: F401


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'historical_dir', str(tmp_path / 'historical'))
    monkeypatch.setattr(settings, 'artifacts_dir', str(tmp_path / 'artifacts'))
    monkeypatch.setattr(settings, 'reports_dir', str(tmp_path / 'reports'))
    (tmp_path / 'historical').mkdir()
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
    yield TestClient(app), tmp_path
    app.dependency_overrides.clear()


def _historical_csv_bytes(n_accounts=30, fraud_every=5):
    rows, utr = [], 0
    for i in range(n_accounts):
        acct = f'HIST-ACC-{i:03d}'
        mule = 1 if i % fraud_every == 0 else 0
        for j in range(8 if mule else 2):
            utr += 1
            rows.append([f'UTR-H{utr:05d}', f'{1 + (j % 20):02d}/09/2026 {10 + (j % 8):02d}:00',
                         str(5000 + 100 * j), 'Test Bank', acct, f'HIST-DST-{(i + j) % 40}', str(mule)])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['Transaction ID/UTR', 'Transaction Date/Time', 'Fraud Amount',
                'Debit Bank Wallet Merchant', 'Debit Account Wallet UPI ID',
                'Credit Account Wallet UPI ID', 'label'])
    w.writerows(rows)
    return buf.getvalue().encode()


def _import(client, content, name, source_type):
    from conftest import MAPPING
    payload = json.dumps({'file_name': f'{name}.csv', 'mapping': MAPPING,
                          'source_type': source_type, 'name': name, 'currency': 'INR'})
    r = client.post('/api/v1/datasets/import',
                    files={'file': (f'{name}.csv', content, 'text/csv')},
                    data={'payload': payload})
    assert r.status_code in (200, 201), r.text
    return r.json()['dataset_id']


def test_full_api_flow(client):
    c, tmp_path = client
    hist = _historical_csv_bytes()
    (tmp_path / 'historical' / 'hist.csv').write_bytes(hist)
    hist_id = _import(c, hist, 'hist', 'historical')

    r = c.post('/api/v1/training-runs', json={'dataset_ids': [hist_id]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body['status'] == 'completed'
    assert body['metrics']['mode'] == 'supervised'
    assert 'holdout' in body['metrics'] and 'dev' in body['metrics']

    r = c.get('/api/v1/models')
    assert r.status_code == 200
    models = r.json()['models']
    assert len(models) == 1 and models[0]['active'] is True

    cur_id = _import(c, b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR-A1,05/09/2026 10:00,90000,HDFC Bank,ACC-A,ACC-B
UTR-A2,05/09/2026 11:00,85000,HDFC Bank,ACC-B,ACC-C
""", 'cur', 'current')
    r = c.post('/api/v1/analysis-runs', json={'dataset_id': cur_id})
    assert r.status_code == 201, r.text
    run_id = r.json()['id']
    assert r.json()['status'] == 'completed'

    r = c.get(f'/api/v1/analysis-runs/{run_id}/assessments')
    assert r.status_code == 200
    assert r.json()['count'] > 0
    first = r.json()['assessments'][0]
    assert 'features' in first['indicators'] and 'warnings' in first

    r = c.get(f'/api/v1/analysis-runs/{run_id}/graph')
    assert r.status_code == 200
    assert len(r.json()['edges']) == 2

    r = c.get(f'/api/v1/analysis-runs/{run_id}/trace',
              params={'account_ref': 'ACC-A', 'direction': 'forward', 'max_hops': 2})
    assert r.status_code == 200
    assert r.json()['path_count'] >= 1
    r = c.get(f'/api/v1/analysis-runs/{run_id}/trace',
              params={'account_ref': 'ACC-A', 'direction': 'sideways'})
    assert r.status_code == 422
    assert r.json()['error']['code'] == 'invalid_direction'

    r = c.get(f'/api/v1/analysis-runs/{run_id}/findings')
    assert r.status_code == 200
    for f in r.json()['findings']:
        fid = f['id']
        r2 = c.patch(f'/api/v1/findings/{fid}', json={'status': 'acknowledged'})
        assert r2.status_code == 200 and r2.json()['status'] == 'acknowledged'
        r3 = c.post(f'/api/v1/findings/{fid}/notes', json={'note': 'Reviewed against source records.'})
        assert r3.status_code == 201
        r4 = c.patch(f'/api/v1/findings/{fid}', json={'status': 'bogus'})
        assert r4.status_code == 422
        break

    r = c.get(f'/api/v1/analysis-runs/{run_id}/report.pdf')
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/pdf'
    assert r.content[:4] == b'%PDF'

    r = c.get('/api/v1/analysis-runs/nope')
    assert r.status_code == 404
    r = c.post('/api/v1/analysis-runs', json={'dataset_id': hist_id})
    assert r.status_code == 422  # historical dataset refused for analysis
    assert r.json()['error']['code'] == 'not_current'


def test_training_rejects_current_via_api(client):
    c, tmp_path = client
    cur = b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR-B1,05/09/2026 10:00,90000,HDFC Bank,ACC-A,ACC-B
"""
    cur_id = _import(c, cur, 'cur', 'current')
    r = c.post('/api/v1/training-runs', json={'dataset_ids': [cur_id]})
    assert r.status_code == 422
    assert r.json()['error']['code'] == 'not_historical'
    r = c.post('/api/v1/training-runs', json={'dataset_ids': ['missing']})
    assert r.status_code == 404
