"""Account-level feature extraction from persisted transactions (SRS FR-04, section 7).

Features are computed ONLY from stored records for one dataset. The ordered
FEATURE_NAMES list is the versioned feature schema (feature_version='acct-v1');
training and inference must agree on it - see services/training.py and
services/analysis.py. No labels, outcomes, or post-investigation fields are
used (leakage guard). Monetary inputs come from NUMERIC storage.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, Transaction

FEATURE_VERSION = 'acct-v1'
FEATURE_NAMES = [
    'out_count',
    'in_count',
    'total_sent',
    'total_received',
    'distinct_receivers',
    'distinct_senders',
    'in_out_amount_ratio',
    'pass_through_ratio_24h',
    'max_burst_1h',
    'mean_inter_txn_hours',
]


def _max_burst_1h(timestamps: list[datetime]) -> int:
    """Max number of transactions in any 60-minute sliding window (burst velocity)."""
    if not timestamps:
        return 0
    ts = sorted(timestamps)
    best = 1
    j = 0
    for i in range(len(ts)):
        while ts[i] - ts[j] > timedelta(hours=1):
            j += 1
        best = max(best, i - j + 1)
    return best


def _mean_gap_hours(timestamps: list[datetime]) -> float:
    ts = sorted(timestamps)
    if len(ts) < 2:
        return 0.0
    gaps = [(ts[i + 1] - ts[i]).total_seconds() / 3600.0 for i in range(len(ts) - 1)]
    return sum(gaps) / len(gaps)


def compute_account_features(db: Session, dataset_id: str) -> dict[str, dict]:
    """Return {account_id: {feature: value, ...}} for every account in a dataset.

    Also returns per-account evidence: the source transaction IDs behind the
    rapid-pass-through indicator, so assessments can cite stored records.
    """
    accounts = db.execute(
        select(Account).where(Account.dataset_id == dataset_id)
    ).scalars().all()
    txns = db.execute(
        select(Transaction).where(Transaction.dataset_id == dataset_id)
    ).scalars().all()

    out_map: dict[str, list[Transaction]] = {}
    in_map: dict[str, list[Transaction]] = {}
    for t in txns:
        out_map.setdefault(t.source_account_id, []).append(t)
        if t.destination_account_id:
            in_map.setdefault(t.destination_account_id, []).append(t)

    result: dict[str, dict] = {}
    for acct in accounts:
        outs = out_map.get(acct.id, [])
        ins = in_map.get(acct.id, [])
        total_sent = float(sum(float(t.amount) for t in outs))
        total_received = float(sum(float(t.amount) for t in ins))
        distinct_receivers = len({t.destination_account_id for t in outs if t.destination_account_id})
        distinct_senders = len({t.source_account_id for t in ins})

        # Rapid pass-through: received amount forwarded within 24h (FIFO over
        # observed flows; a hypothesis about observed records, never a claim
        # about conserved principal).
        forwarded = 0.0
        pass_through_evidence: list[str] = []
        for tin in sorted(ins, key=lambda t: t.ts):
            window_end = tin.ts + timedelta(hours=24)
            remaining = float(tin.amount)
            for tout in sorted(outs, key=lambda t: t.ts):
                if tout.ts < tin.ts or tout.ts > window_end:
                    continue
                take = min(remaining, float(tout.amount))
                if take > 0:
                    forwarded += take
                    remaining -= take
                    pass_through_evidence.append(
                        tout.external_txn_ref or tout.id
                    )
                if remaining <= 0:
                    break
        pass_ratio = (forwarded / total_received) if total_received > 0 else 0.0

        all_ts = [t.ts for t in outs] + [t.ts for t in ins]
        in_out_ratio = (total_received / total_sent) if total_sent > 0 else (
            float('inf') if total_received > 0 else 0.0
        )
        result[acct.id] = {
            'features': {
                'out_count': float(len(outs)),
                'in_count': float(len(ins)),
                'total_sent': total_sent,
                'total_received': total_received,
                'distinct_receivers': float(distinct_receivers),
                'distinct_senders': float(distinct_senders),
                # Cap ratio to keep the model input bounded; documented, deterministic.
                'in_out_amount_ratio': min(in_out_ratio, 100.0),
                'pass_through_ratio_24h': pass_ratio,
                'max_burst_1h': float(_max_burst_1h(all_ts)),
                'mean_inter_txn_hours': _mean_gap_hours(all_ts),
            },
            'evidence': {
                'pass_through_txn_refs': sorted(set(pass_through_evidence)),
                'out_txn_refs': sorted({t.external_txn_ref or t.id for t in outs}),
                'in_txn_refs': sorted({t.external_txn_ref or t.id for t in ins}),
            },
            'warnings': _data_quality_warnings(outs, ins),
        }
    return result


def _data_quality_warnings(outs: Iterable[Transaction], ins: Iterable[Transaction]) -> list[str]:
    warnings: list[str] = []
    ins = list(ins)
    outs = list(outs)
    if outs and not ins:
        warnings.append('only_outgoing_observed')
    if ins and not outs:
        warnings.append('only_incoming_observed')
    if any(t.destination_account_id is None for t in outs):
        warnings.append('recipient_missing_on_some_rows')
    if not outs and not ins:
        warnings.append('no_transactions_observed')
    return warnings


def feature_vector(feature_map: dict) -> list[float]:
    """Ordered vector matching FEATURE_NAMES; inference validates order."""
    return [float(feature_map[name]) for name in FEATURE_NAMES]
