"""Deterministic rule indicators (SRS FR-04: kept separate from ML outputs).

Each rule is explainable, versioned, and cites evidence transaction refs from
stored records. Thresholds are defaults and must remain configurable; they are
triage indicators, not legal conclusions.
"""
from __future__ import annotations

RULES_VERSION = 'rules-v1'

DEFAULT_THRESHOLDS = {
    'fan_in_min_senders': 5,
    'fan_out_min_receivers': 5,
    'pass_through_min_ratio': 0.8,
    'pass_through_min_received': 10000.0,
    'burst_min_txn_1h': 5,
}


def evaluate_rules(feature_map: dict, evidence: dict, thresholds: dict | None = None) -> list[dict]:
    """Return triggered rules as indicator dicts with reasons + evidence refs."""
    t = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    f = feature_map
    triggered: list[dict] = []

    if f['distinct_senders'] >= t['fan_in_min_senders']:
        triggered.append({
            'rule': 'high_fan_in',
            'reason': f"{int(f['distinct_senders'])} distinct senders observed "
                      f"(threshold {t['fan_in_min_senders']})",
            'evidence_txn_refs': evidence.get('in_txn_refs', []),
        })
    if f['distinct_receivers'] >= t['fan_out_min_receivers']:
        triggered.append({
            'rule': 'high_fan_out',
            'reason': f"{int(f['distinct_receivers'])} distinct receivers observed "
                      f"(threshold {t['fan_out_min_receivers']})",
            'evidence_txn_refs': evidence.get('out_txn_refs', []),
        })
    if (f['pass_through_ratio_24h'] >= t['pass_through_min_ratio']
            and f['total_received'] >= t['pass_through_min_received']):
        triggered.append({
            'rule': 'rapid_pass_through',
            'reason': f"{f['pass_through_ratio_24h']:.0%} of observed incoming amount "
                      f"forwarded within 24h on received total {f['total_received']:.2f}",
            'evidence_txn_refs': evidence.get('pass_through_txn_refs', []),
        })
    if f['max_burst_1h'] >= t['burst_min_txn_1h']:
        triggered.append({
            'rule': 'burst_velocity',
            'reason': f"{int(f['max_burst_1h'])} transactions within one 60-minute window "
                      f"(threshold {t['burst_min_txn_1h']})",
            'evidence_txn_refs': (evidence.get('in_txn_refs', [])
                                  + evidence.get('out_txn_refs', [])),
        })
    return triggered
