"""Phase 1 acceptance tests (SRS section 12): validation, import counts,
source-row traceability, duplicate policy, honest errors."""
import json

from app.models import Account, AuditEvent, Dataset, Transaction
from app.services import ingestion

from conftest import BAD_ROWS_CSV, DUP_CSV, MAPPING, VALID_CSV


def test_validate_accepts_valid_csv():
    r = ingestion.validate_csv(VALID_CSV)
    assert r['valid'] is True
    assert r['row_count'] == 3
    assert r['suggested_mapping'] == MAPPING
    assert not any(i['level'] == 'error' for i in r['issues'])


def test_validate_rejects_missing_required_column():
    csv_no_amount = b"Transaction ID/UTR,Transaction Date/Time,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID\nU1,01/09/2026,100,HDFC,A1\n"
    r = ingestion.validate_csv(csv_no_amount)
    assert r['valid'] is False
    assert any('amount_lost' in i['message'] for i in r['issues'])


def test_validate_warns_when_recipient_missing():
    r = ingestion.validate_csv(b"Transaction ID/UTR,Transaction Date/Time,Fraud Amount,Debit Bank Wallet Merchant,Debit Account Wallet UPI ID\nU1,01/09/2026,100,HDFC,A1\n")
    assert any(i['level'] == 'warning' and 'money-trail' in i['message'] for i in r['issues'])


def test_validate_rejects_non_utf8():
    r = ingestion.validate_csv(b'\xff\xfe\x00bad')
    assert r['valid'] is False


def test_import_counts_and_traceability(db):
    out = ingestion.import_csv(db, content=BAD_ROWS_CSV, file_name='bad.csv',
                               mapping=MAPPING, source_type='current', name='t1')
    assert out['accepted'] == 2
    assert out['rejected'] == 3
    assert out['reject_reasons'] == {'malformed timestamp': 1, 'malformed amount': 1, 'missing transaction id': 1}
    txns = db.query(Transaction).filter_by(dataset_id=out['dataset_id']).order_by(Transaction.raw_row_ref).all()
    assert [t.raw_row_ref for t in txns] == [1, 5]  # accepted source rows 1 and 5 preserved
    ds = db.get(Dataset, out['dataset_id'])
    counts = json.loads(ds.row_counts_json)
    assert counts == {'accepted': 2, 'rejected': 3, 'duplicates': 0}
    # import is audited
    ev = db.query(AuditEvent).filter_by(action='DATASET_IMPORT', target_id=ds.id).one()
    assert 'checksum' in json.loads(ev.metadata_json)


def test_import_duplicate_policy_flags_not_deletes(db):
    out = ingestion.import_csv(db, content=DUP_CSV, file_name='dup.csv',
                               mapping=MAPPING, source_type='current', name='t2')
    assert out['accepted'] == 2
    assert out['duplicates'] == 1
    txns = db.query(Transaction).filter_by(dataset_id=out['dataset_id']).all()
    flagged = [t for t in txns if t.duplicate_of]
    assert len(flagged) == 1
    assert flagged[0].duplicate_of != flagged[0].id


def test_import_never_overwrites_prior_dataset(db):
    out1 = ingestion.import_csv(db, content=VALID_CSV, file_name='a.csv',
                                mapping=MAPPING, source_type='current', name='first')
    out2 = ingestion.import_csv(db, content=VALID_CSV, file_name='a.csv',
                                mapping=MAPPING, source_type='current', name='second')
    assert out1['dataset_id'] != out2['dataset_id']
    assert db.query(Dataset).count() == 2


def test_accounts_created_from_records(db):
    out = ingestion.import_csv(db, content=VALID_CSV, file_name='a.csv',
                               mapping=MAPPING, source_type='current', name='accs')
    refs = {a.external_account_ref for a in db.query(Account).filter_by(dataset_id=out['dataset_id'])}
    assert refs == {'ACC-M1', 'ACC-M2', 'ACC-M3', 'ACC-M4'}


def test_import_rejects_bad_mapping(db):
    try:
        ingestion.import_csv(db, content=VALID_CSV, file_name='a.csv',
                             mapping={'transaction_id_or_utr': 'Transaction ID/UTR'},
                             source_type='current', name='bad')
        assert False, 'should have raised'
    except ValueError as e:
        assert 'Missing required mappings' in str(e)
