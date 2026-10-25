"""CSV validation, preview, and import per SRS FR-03 and section 7.

Portal-aligned minimum fields. Original headers, source row numbers, file
checksum and import batch ID are always preserved. Duplicate policy: external
transaction ID scoped to the dataset; otherwise a documented composite
fingerprint, flagged rather than silently deleted.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.models import Account, AuditEvent, Dataset, ImportBatch, Transaction

# Canonical field -> accepted source aliases (normalised: lowercase, punctuation -> space)
FIELD_SYNONYMS: dict[str, list[str]] = {
    'transaction_id_or_utr': ['transaction id', 'transaction id utr', 'utr', 'transaction id or utr', 'reference number', 'ref', 'txn id'],
    'transaction_datetime': ['transaction date time', 'transaction date', 'date time', 'txn date', 'date', 'timestamp', 'value date'],
    'amount_lost': ['fraud amount', 'amount paid', 'amount', 'amount lost', 'amount inr'],
    'debit_bank_wallet_merchant': ['debit bank wallet merchant', 'debit bank', 'payer bank', 'sender bank', 'from bank'],
    'debit_account_wallet_upi_id': ['debit account wallet upi id', 'debit account', 'payer account', 'sender account', 'from account', 'remitter'],
    'credit_bank_wallet_merchant': ['credit bank wallet merchant', 'credit bank', 'payee bank', 'receiver bank', 'to bank'],
    'credit_account_wallet_upi_id': ['credit account wallet upi id', 'credit account', 'payee account', 'receiver account', 'to account', 'beneficiary account'],
    'complaint_acknowledgement_id': ['complaint acknowledgement id', 'ack no', 'acknowledgement', 'complaint id', 'ncrp ref'],
    'merchant_gateway_details': ['merchant gateway details', 'merchant details', 'payment gateway', 'gateway'],
}
REQUIRED = ['transaction_id_or_utr', 'transaction_datetime', 'amount_lost',
            'debit_bank_wallet_merchant', 'debit_account_wallet_upi_id']


def _norm(h: str) -> str:
    return ' '.join(h.strip().lower().replace('_', ' ').replace('/', ' ').replace('.', ' ').split())


def suggest_mapping(headers: list[str]) -> dict[str, str]:
    """Suggest canonical-field -> source-header mapping; analyst reviews before import."""
    normed = [_norm(h) for h in headers]
    out: dict[str, str] = {}
    for field, synonyms in FIELD_SYNONYMS.items():
        for i, h in enumerate(normed):
            if h in synonyms:
                out[field] = headers[i]
                break
    return out


def _parse_ts(raw: str) -> datetime | None:
    t = raw.strip()
    if not t:
        return None
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%d/%m/%Y %H:%M', '%d-%m-%Y %H:%M',
                '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            dt = datetime.strptime(t, fmt)
            return dt.replace(tzinfo=timezone.utc)  # assumption recorded: naive treated as UTC
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> Decimal | None:
    cleaned = raw.replace(',', '').replace('₹', '').strip()
    try:
        n = Decimal(cleaned)
    except InvalidOperation:
        return None
    return n if n >= 0 else None


def _fingerprint(parts: list[str]) -> str:
    return hashlib.sha256('|'.join(parts).encode()).hexdigest()


def validate_csv(content: bytes, max_rows: int = 500_000) -> dict:
    """Validate without committing. Returns preview, suggested mapping, issues, counts."""
    checksum = hashlib.sha256(content).hexdigest()
    issues: list[dict] = []
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        return {'checksum': checksum, 'valid': False,
                'issues': [{'level': 'error', 'message': 'File is not valid UTF-8 text.'}]}
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(c.strip() for c in r)]
    if not rows:
        return {'checksum': checksum, 'valid': False,
                'issues': [{'level': 'error', 'message': 'No data rows found.'}]}
    headers = [h.strip() for h in rows[0]]
    if len(headers) != len(set(headers)):
        issues.append({'level': 'error', 'message': 'Duplicate header names in source file.'})
    mapping = suggest_mapping(headers)
    missing = [f for f in REQUIRED if f not in mapping]
    for f in missing:
        issues.append({'level': 'error', 'message': f'Required field "{f}" could not be matched to a column.'})
    if 'credit_account_wallet_upi_id' not in mapping:
        issues.append({'level': 'warning',
                       'message': 'No recipient account column found - multi-hop money-trail tracing will be limited. Import what is usable; missing recipients are never invented.'})
    data_rows = rows[1:]
    if len(data_rows) > max_rows:
        issues.append({'level': 'error', 'message': f'Row count {len(data_rows)} exceeds the configured limit {max_rows}.'})
    # row-level validation on a bounded sample for the preview
    bad = 0
    samples: list[dict] = []
    for idx, r in enumerate(data_rows[:200], start=1):
        rec = dict(zip(headers, r))
        ok = True
        if 'transaction_datetime' in mapping and not _parse_ts(rec.get(mapping['transaction_datetime'], '')):
            ok = False
        if 'amount_lost' in mapping and _parse_amount(rec.get(mapping['amount_lost'], '')) is None:
            ok = False
        if not ok:
            bad += 1
        if len(samples) < 5:
            samples.append({'row': idx, 'ok': ok, 'values': rec})
    valid = not any(i['level'] == 'error' for i in issues)
    return {'checksum': checksum, 'valid': valid, 'headers': headers, 'suggested_mapping': mapping,
            'row_count': len(data_rows), 'sample': samples, 'sample_invalid': bad, 'issues': issues}


def import_csv(db: Session, *, content: bytes, file_name: str, mapping: dict[str, str],
               source_type: str, name: str, currency: str = 'INR',
               actor_ref: str = 'local-session') -> dict:
    """Confirm import: new dataset + import batch, no overwrite of prior datasets."""
    missing = [f for f in REQUIRED if f not in mapping]
    if missing:
        raise ValueError(f'Missing required mappings: {missing}')
    checksum = hashlib.sha256(content).hexdigest()
    text = content.decode('utf-8-sig')
    rows = [r for r in csv.reader(io.StringIO(text)) if any(c.strip() for c in r)]
    headers = [h.strip() for h in rows[0]]
    dataset = Dataset(id=str(uuid.uuid4()), name=name, source_type=source_type, checksum=checksum,
                      currency=currency, status='importing')
    batch = ImportBatch(id=str(uuid.uuid4()), dataset_id=dataset.id, file_name=file_name,
                        checksum=checksum, original_headers_json=json.dumps(headers),
                        column_mapping_json=json.dumps(mapping), status='running')
    db.add_all([dataset, batch])
    db.flush()

    accounts_by_ref: dict[str, Account] = {}
    seen_external: dict[str, str] = {}  # external_txn_ref -> txn id (scoped to this dataset)
    seen_fp: dict[str, str] = {}
    accepted = rejected = duplicates = 0
    reject_reasons: dict[str, int] = {}

    def account_for(ref: str) -> Account:
        ref = ref.strip()
        if ref not in accounts_by_ref:
            acc = Account(id=str(uuid.uuid4()), dataset_id=dataset.id, external_account_ref=ref)
            db.add(acc)
            accounts_by_ref[ref] = acc
        return accounts_by_ref[ref]

    for row_no, r in enumerate(rows[1:], start=1):
        rec = dict(zip(headers, r + [''] * (len(headers) - len(r))))
        txn_ref = rec.get(mapping['transaction_id_or_utr'], '').strip()
        ts = _parse_ts(rec.get(mapping['transaction_datetime'], ''))
        amount = _parse_amount(rec.get(mapping['amount_lost'], ''))
        debit_ref = rec.get(mapping['debit_account_wallet_upi_id'], '').strip()
        credit_ref = (rec.get(mapping.get('credit_account_wallet_upi_id', ''), '') or '').strip()
        reason = None
        if not txn_ref:
            reason = 'missing transaction id'
        elif ts is None:
            reason = 'malformed timestamp'
        elif amount is None:
            reason = 'malformed amount'
        elif not debit_ref:
            reason = 'missing debit account'
        if reason:
            rejected += 1
            reject_reasons[reason] = reject_reasons.get(reason, 0) + 1
            continue
        fp = _fingerprint([txn_ref, str(ts), str(amount), debit_ref, credit_ref])
        dup_of = seen_external.get(txn_ref) or seen_fp.get(fp)
        src = account_for(debit_ref)
        dst = account_for(credit_ref) if credit_ref else None
        txn = Transaction(id=str(uuid.uuid4()), dataset_id=dataset.id, batch_id=batch.id,
                          external_txn_ref=txn_ref, source_account_id=src.id,
                          destination_account_id=dst.id if dst else None,
                          amount=amount, currency=currency, ts=ts, raw_row_ref=row_no,
                          fingerprint=fp, duplicate_of=dup_of)
        if dup_of:
            duplicates += 1  # retained and flagged, never silently dropped or double-counted later
        else:
            seen_external[txn_ref] = txn.id
            seen_fp[fp] = txn.id
            accepted += 1
        db.add(txn)

    batch.accepted_count, batch.rejected_count, batch.duplicate_count = accepted, rejected, duplicates
    batch.status = 'completed'
    dataset.status = 'imported'
    dataset.row_counts_json = json.dumps({'accepted': accepted, 'rejected': rejected, 'duplicates': duplicates})
    db.add(AuditEvent(id=str(uuid.uuid4()), actor_ref=actor_ref, action='DATASET_IMPORT',
                      target_type='dataset', target_id=dataset.id,
                      metadata_json=json.dumps({'file': file_name, 'checksum': checksum,
                                                'accepted': accepted, 'rejected': rejected,
                                                'duplicates': duplicates,
                                                'reject_reasons': reject_reasons})))
    db.commit()
    return {'dataset_id': dataset.id, 'batch_id': batch.id, 'accepted': accepted,
            'rejected': rejected, 'duplicates': duplicates, 'reject_reasons': reject_reasons,
            'accounts': len(accounts_by_ref)}
