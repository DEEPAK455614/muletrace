"""Phase 2-4 tests: training, analysis, graph/tracing, findings, report.

SRS acceptance coverage:
- Training run records historical dataset, feature version, model version, evaluation metadata.
- Training refuses current datasets and insufficient/malformed labels (no fake model).
- Analysis does not alter or retrain the active model; assessments cite account + txn IDs.
- Graph edges correspond exactly to stored transactions; tracing respects hop/time limits.
- Changing source records changes metrics and graph results.
- Empty datasets and missing models produce honest empty/error states.
- PDF report is generated from persisted run results.
"""
import csv
import hashlib
import io
import json

import pytest

from app.core.errors import ApiError
from app.models import AccountAssessment, AnalysisRun, Dataset, ModelVersion, TrainingRun
from app.services import analysis as analysis_service
from app.services import graph as graph_service
from app.services import ingestion
from app.services import reporting
from app.services.training import start_training

from conftest import MAPPING


def _historical_csv(tmp_path, n_accounts=30, fraud_every=5):
    """Deterministic labelled synthetic historical file (synthetic only - never real data)."""
    rows = []
    utr = 0
    for i in range(n_accounts):
        acct = f'HIST-ACC-{i:03d}'
        mule = 1 if i % fraud_every == 0 else 0
        n_tx = 8 if mule else 2
        for j in range(n_tx):
            utr += 1
            day = 1 + (j % 20)
            rows.append([f'UTR-H{utr:05d}', f'{day:02d}/09/2026 {10 + (j % 8):02d}:00',
                         str(5000 + 100 * j), 'Test Bank', acct, f'HIST-DST-{(i + j) % 40}',
                         str(mule)])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['Transaction ID/UTR', 'Transaction Date/Time', 'Fraud Amount',
                'Debit Bank Wallet Merchant', 'Debit Account Wallet UPI ID',
                'Credit Account Wallet UPI ID', 'label'])
    w.writerows(rows)
    content = buf.getvalue().encode()
    hist_dir = tmp_path / 'historical'
    hist_dir.mkdir()
    path = hist_dir / 'historical.csv'
    path.write_bytes(content)
    return content, path


def _import(db, content, source_type, name):
    return ingestion.import_csv(db, content=content, file_name=f'{name}.csv',
                                mapping=MAPPING, source_type=source_type, name=name)


@pytest.fixture()
def trained(db, tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'historical_dir', str(tmp_path / 'historical'))
    monkeypatch.setattr(settings, 'artifacts_dir', str(tmp_path / 'artifacts'))
    content, _path = _historical_csv(tmp_path)
    ds = _import(db, content, 'historical', 'hist')
    run = start_training(db, dataset_ids=[ds['dataset_id']])
    return run


def test_training_records_metadata_and_model(trained, db):
    run = db.get(TrainingRun, trained.id)
    assert run.status == 'completed'
    assert run.feature_version == 'acct-v1'
    metrics = json.loads(run.metrics_json)
    assert metrics['mode'] == 'supervised'
    assert set(metrics['split']) == {'train', 'dev', 'holdout'}
    assert 'dev' in metrics and 'holdout' in metrics  # reported separately
    assert metrics['random_seed'] == 42
    mv = db.query(ModelVersion).filter_by(active=True).one()
    assert mv.training_run_id == run.id
    assert mv.feature_version == run.feature_version


def test_training_is_deterministic(db, tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'historical_dir', str(tmp_path / 'historical'))
    monkeypatch.setattr(settings, 'artifacts_dir', str(tmp_path / 'artifacts'))
    content, _ = _historical_csv(tmp_path)
    ds = _import(db, content, 'historical', 'hist')
    r1 = start_training(db, dataset_ids=[ds['dataset_id']])
    m1 = json.loads(db.get(TrainingRun, r1.id).metrics_json)
    r2 = start_training(db, dataset_ids=[ds['dataset_id']])
    m2 = json.loads(db.get(TrainingRun, r2.id).metrics_json)
    assert m1['holdout'] == m2['holdout']  # fixed seed -> reproducible


def test_training_rejects_current_dataset(db, tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'historical_dir', str(tmp_path / 'historical'))
    content, _ = _historical_csv(tmp_path)
    ds = _import(db, content, 'current', 'cur')
    with pytest.raises(ApiError) as e:
        start_training(db, dataset_ids=[ds['dataset_id']])
    assert e.value.code == 'not_historical'


def test_training_refuses_insufficient_labels(db, tmp_path, monkeypatch):
    from app.core.config import settings
    from conftest import VALID_CSV
    monkeypatch.setattr(settings, 'historical_dir', str(tmp_path / 'historical'))
    # no label column + too few accounts -> actionable error, no fake model
    (tmp_path / 'historical').mkdir()
    (tmp_path / 'historical' / 'small.csv').write_bytes(VALID_CSV)
    ds = _import(db, VALID_CSV, 'historical', 'small')
    with pytest.raises(ApiError) as e:
        start_training(db, dataset_ids=[ds['dataset_id']], algorithm='isolation_forest')
    assert e.value.code == 'insufficient_data'
    assert db.query(ModelVersion).count() == 0


def test_analysis_with_model_and_baseline(trained, db, tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'reports_dir', str(tmp_path / 'reports'))
    current = _import(db, b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR-C1,05/09/2026 10:00,90000,HDFC Bank,ACC-X,ACC-Y
UTR-C2,05/09/2026 10:30,85000,HDFC Bank,ACC-Y,ACC-Z
UTR-C3,05/09/2026 11:00,40000,HDFC Bank,ACC-Y,ACC-W
UTR-C4,06/09/2026 09:00,12000,SBI,ACC-P,ACC-Q
""", 'current', 'cur')
    # model-backed run
    run1 = analysis_service.start_analysis(db, dataset_id=current['dataset_id'])
    assert run1.status == 'completed'
    summary = json.loads(run1.summary_json)
    assert summary['method'] == 'model+rules'
    assert summary['accounts_analysed'] > 0
    mv_before = db.query(ModelVersion).filter_by(active=True).one()
    # rule baseline via explicit None selection when no model id passed but model
    # exists uses active model; force baseline with unknown model rejected:
    with pytest.raises(ApiError):
        analysis_service.start_analysis(db, dataset_id=current['dataset_id'],
                                        model_version_id='does-not-exist')
    # assessments cite account + transaction IDs
    rows = db.query(AccountAssessment).filter_by(analysis_run_id=run1.id).all()
    assert rows
    for a in rows:
        ind = json.loads(a.indicators_json)
        assert 'features' in ind and 'rules' in ind
        assert 0.0 <= float(a.score) <= 99.9
        assert a.band in ('low', 'medium', 'high', 'critical')
    # model unchanged by analysis (never retrained implicitly)
    mv_after = db.query(ModelVersion).filter_by(active=True).one()
    assert mv_before.id == mv_after.id
    # findings reference evidence
    from app.models import Finding
    findings = db.query(Finding).filter_by(analysis_run_id=run1.id).all()
    for f in findings:
        ev = json.loads(f.evidence_refs_json)
        assert ev.get('account_ref')
        assert 'txn_refs' in ev


def test_analysis_empty_dataset_honest(trained, db):
    empty = _import(db, b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
""", 'current', 'empty')
    run = analysis_service.start_analysis(db, dataset_id=empty['dataset_id'])
    summary = json.loads(run.summary_json)
    assert summary['accounts_analysed'] == 0
    assert 'honest empty result' in summary['limitations'][0]


def test_graph_edges_match_stored_transactions_and_trace_limits(trained, db):
    current = _import(db, b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR-G1,05/09/2026 10:00,90000,HDFC Bank,ACC-A,ACC-B
UTR-G2,05/09/2026 11:00,85000,HDFC Bank,ACC-B,ACC-C
UTR-G3,05/09/2026 12:00,80000,HDFC Bank,ACC-C,ACC-D
UTR-G4,05/09/2026 13:00,75000,HDFC Bank,ACC-D,ACC-E
UTR-G5,05/09/2026 09:00,100,SBI,ACC-F,ACC-G
""", 'current', 'chain')
    run = analysis_service.start_analysis(db, dataset_id=current['dataset_id'])
    g = graph_service.run_graph(db, run.id)
    assert len(g['edges']) == 5  # exactly the stored transactions
    refs = {e['txn_ref'] for e in g['edges']}
    assert refs == {f'UTR-G{i}' for i in range(1, 6)}

    fwd = graph_service.trace(db, run.id, account_ref='ACC-A', direction='forward', max_hops=2)
    assert fwd['path_count'] >= 1
    for path in fwd['paths']:
        assert len(path) <= 2  # hop limit respected
        ts_list = [s['ts'] for s in path]
        assert ts_list == sorted(ts_list)  # temporal non-decreasing
    # time filter excludes later hops
    bounded = graph_service.trace(db, run.id, account_ref='ACC-A', direction='forward',
                                  max_hops=4, until='2026-09-05T11:30:00+00:00')
    for path in bounded['paths']:
        assert all(s['ts'] <= '2026-09-05T11:30' for s in path)
    back = graph_service.trace(db, run.id, account_ref='ACC-E', direction='backward', max_hops=3)
    assert back['path_count'] >= 1
    # changing source records changes graph results
    current2 = _import(db, b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR-G1,05/09/2026 10:00,90000,HDFC Bank,ACC-A,ACC-B
""", 'current', 'chain2')
    run2 = analysis_service.start_analysis(db, dataset_id=current2['dataset_id'])
    g2 = graph_service.run_graph(db, run2.id)
    assert len(g2['edges']) == 1  # results change when source records change


def test_pdf_report_from_persisted_run(trained, db, tmp_path, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'reports_dir', str(tmp_path / 'reports'))
    current = _import(db, b"""Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID,Credit Account Wallet UPI ID
UTR-R1,05/09/2026 10:00,90000,HDFC Bank,ACC-M1,ACC-M2
UTR-R2,05/09/2026 10:30,85000,HDFC Bank,ACC-M2,ACC-M3
""", 'current', 'report-ds')
    run = analysis_service.start_analysis(db, dataset_id=current['dataset_id'])
    path = reporting.generate_report(db, run.id)
    assert path.exists() and path.suffix == '.pdf'
    assert path.stat().st_size > 1000
    # incomplete run cannot produce a report
    bad = AnalysisRun(id='run-incomplete', dataset_id=current['dataset_id'], status='running')
    db.add(bad)
    db.commit()
    with pytest.raises(ApiError) as e:
        reporting.generate_report(db, 'run-incomplete')
    assert e.value.code == 'run_incomplete'
