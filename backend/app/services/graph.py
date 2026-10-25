"""Transaction graph + bounded money-trail tracing (SRS FR-06, section 7).

Edges are built ONLY from stored transactions: source_account -> destination_account
with transaction ID, amount, timestamp, dataset. Tracing is bounded BFS with a
temporal non-decreasing constraint; hop limits and result caps are mandatory so
expansion never becomes unbounded. Empty/disconnected graphs are returned
honestly - never replaced with sample data.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

import networkx as nx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError


def _coerce_dt(value):
    if value is None or isinstance(value, datetime):
        return value
    try:
        dt = datetime.fromisoformat(str(value))
    except ValueError:
        raise ApiError(422, 'invalid_datetime', f'"{value}" is not an ISO-8601 datetime.')
    # Stored timestamps are UTC; SQLite round-trips them naive. Normalise aware
    # inputs to naive UTC so comparisons are consistent in both DB modes.
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt
from app.models import Account, AccountAssessment, AnalysisRun, Transaction

MAX_HOPS_LIMIT = 10
MAX_EDGES = 500
MAX_PATHS = 50


def _load(db: Session, run_id: str) -> tuple[AnalysisRun, dict[str, Account], list[Transaction]]:
    run = db.get(AnalysisRun, run_id)
    if run is None:
        raise ApiError(404, 'run_not_found', 'Unknown analysis run id.')
    accounts = db.execute(select(Account).where(Account.dataset_id == run.dataset_id)).scalars().all()
    txns = db.execute(select(Transaction).where(Transaction.dataset_id == run.dataset_id)).scalars().all()
    return run, {a.id: a for a in accounts}, txns


def run_graph(db: Session, run_id: str, *, min_amount: float | None = None,
              since: datetime | None = None, until: datetime | None = None,
              limit: int = MAX_EDGES) -> dict:
    """Bounded graph slice for an analysis run's dataset."""
    limit = max(1, min(limit, MAX_EDGES))
    run, accounts, txns = _load(db, run_id)
    since = _coerce_dt(since)
    until = _coerce_dt(until)
    edges = []
    truncated = False
    for t in sorted(txns, key=lambda x: x.ts):
        if t.destination_account_id is None:
            continue
        if min_amount is not None and float(t.amount) < min_amount:
            continue
        if since and t.ts < since:
            continue
        if until and t.ts > until:
            continue
        if len(edges) >= limit:
            truncated = True
            break
        edges.append({
            'source': t.source_account_id, 'target': t.destination_account_id,
            'txn_ref': t.external_txn_ref or t.id, 'amount': float(t.amount),
            'currency': t.currency, 'ts': t.ts.isoformat(), 'dataset_id': run.dataset_id,
        })
    node_ids = {e['source'] for e in edges} | {e['target'] for e in edges}
    nodes = [{'id': aid, 'external_ref': accounts[aid].external_account_ref}
             for aid in sorted(node_ids) if aid in accounts]
    return {'run_id': run_id, 'dataset_id': run.dataset_id, 'nodes': nodes, 'edges': edges,
            'truncated': truncated, 'edge_limit': limit,
            'honest_empty': len(edges) == 0,
            'note': 'Edges correspond exactly to stored transactions in this dataset.'}


def trace(db: Session, run_id: str, *, account_ref: str,
          direction: Literal['forward', 'backward'] = 'forward',
          max_hops: int = 3, since: datetime | None = None, until: datetime | None = None,
          min_amount: float | None = None) -> dict:
    """Bounded temporal BFS. Forward: where funds moved next (edges after the
    selected time, non-decreasing timestamps). Backward: where funds came from
    (edges leading into the account, non-increasing going back)."""
    if max_hops < 1 or max_hops > MAX_HOPS_LIMIT:
        raise ApiError(422, 'invalid_hops', f'max_hops must be 1..{MAX_HOPS_LIMIT}.')
    run, accounts, txns = _load(db, run_id)
    since = _coerce_dt(since)
    until = _coerce_dt(until)
    by_ref = {a.external_account_ref: a for a in accounts.values()}
    origin = by_ref.get(account_ref)
    if origin is None:
        raise ApiError(404, 'account_not_found',
                       'Account not found in this dataset. Use an external account ref from the run.')

    g = nx.DiGraph()
    for t in txns:
        if t.destination_account_id is None:
            continue
        if min_amount is not None and float(t.amount) < min_amount:
            continue
        if since and t.ts < since:
            continue
        if until and t.ts > until:
            continue
        g.add_edge(t.source_account_id, t.destination_account_id,
                   txn_ref=t.external_txn_ref or t.id, amount=float(t.amount), ts=t.ts)

    paths: list[list[dict]] = []
    visited_edges: set[tuple] = set()

    def allowed(prev_ts, edge_ts, forward: bool) -> bool:
        return edge_ts >= prev_ts if forward else edge_ts <= prev_ts

    frontier: list[tuple[str, list[dict], datetime | None]] = [(origin.id, [], None)]
    for _hop in range(max_hops):
        nxt: list[tuple[str, list[dict], datetime | None]] = []
        for node, path, last_ts in frontier:
            neighbours = ((n, g[node][n]) for n in g.successors(node)) if direction == 'forward' \
                else ((p, g[p][node]) for p in g.predecessors(node))
            for nb, attrs in neighbours:
                ts = attrs['ts']
                if last_ts is not None and not allowed(last_ts, ts, direction == 'forward'):
                    continue  # temporal path constraint
                key = (nb, attrs['txn_ref'])
                if key in visited_edges:
                    continue
                visited_edges.add(key)
                step = {'from': node if direction == 'forward' else nb,
                        'to': nb if direction == 'forward' else node,
                        'txn_ref': attrs['txn_ref'], 'amount': attrs['amount'],
                        'ts': ts.isoformat()}
                new_path = path + [step]
                paths.append(new_path)
                if len(paths) >= MAX_PATHS:
                    break
                nxt.append((nb, new_path, ts))
            if len(paths) >= MAX_PATHS:
                break
        frontier = nxt
        if len(paths) >= MAX_PATHS or not frontier:
            break

    def node_view(aid: str) -> dict:
        a = accounts.get(aid)
        return {'id': aid, 'external_ref': a.external_account_ref if a else aid}

    return {
        'run_id': run_id, 'origin': node_view(origin.id), 'direction': direction,
        'max_hops': max_hops, 'paths_capped': len(paths) >= MAX_PATHS,
        'paths': [[{**s, 'from': node_view(s['from']), 'to': node_view(s['to']),
                    'from_ref': node_view(s['from'])['external_ref'],
                    'to_ref': node_view(s['to'])['external_ref']} for s in p] for p in paths],
        'path_count': len(paths),
        'note': 'Paths are hypotheses over observed transactions (temporal, bounded); '
                'amounts are not a conserved-principal reconstruction.',
    }


def account_detail(db: Session, run_id: str, account_id: str) -> dict:
    run, accounts, txns = _load(db, run_id)
    acct = accounts.get(account_id)
    if acct is None:
        raise ApiError(404, 'account_not_found', 'Account not found in this run dataset.')
    assessment = db.execute(select(AccountAssessment).where(
        AccountAssessment.analysis_run_id == run_id,
        AccountAssessment.account_id == account_id)).scalars().first()
    related = [t for t in txns if t.source_account_id == account_id or t.destination_account_id == account_id]
    return {
        'account': {'id': acct.id, 'external_ref': acct.external_account_ref},
        'assessment': None if assessment is None else {
            'score': float(assessment.score), 'band': assessment.band, 'method': assessment.method,
            'indicators': assessment.indicators_json, 'warnings': assessment.warnings_json,
        },
        'transactions': [{
            'txn_ref': t.external_txn_ref or t.id, 'amount': float(t.amount), 'ts': t.ts.isoformat(),
            'from_ref': accounts[t.source_account_id].external_account_ref if t.source_account_id in accounts else None,
            'to_ref': accounts[t.destination_account_id].external_account_ref if t.destination_account_id in accounts else None,
            'raw_row_ref': t.raw_row_ref,
        } for t in sorted(related, key=lambda x: x.ts)],
    }
