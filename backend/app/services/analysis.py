"""Current-data analysis service (SRS FR-04, section 5 isolation requirement).

- An analysis run evaluates ONE current dataset with ONE chosen compatible
  model version (or an explicitly labelled rule-based baseline when no model
  exists). It never retrains or alters the active model.
- Documented deterministic scoring strategy (scoring-v1):
    model available:  score = 100 * (0.6 * model_output + 0.4 * rule_fraction)
    no model:         score = 100 * rule_fraction   (method='rule_baseline')
  rule_fraction = triggered_rules / total_rules. Model outputs are
  uncalibrated class-weighted scores - disclosed in every assessment warning;
  they are triage signals, never calibrated fraud probabilities.
- Risk bands (triage levels, configurable defaults, not legal conclusions):
    low < 30 <= medium < 60 <= high < 85 <= critical.
"""
from __future__ import annotations

import json
import uuid

import joblib
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import (Account, AccountAssessment, AnalysisRun, AuditEvent,
                        Dataset, Finding, ModelVersion)
from app.services.features import FEATURE_NAMES, FEATURE_VERSION, compute_account_features, feature_vector
from app.services.rules import RULES_VERSION, DEFAULT_THRESHOLDS, evaluate_rules

SCORING_VERSION = 'scoring-v1'
DEFAULT_BANDS = [('low', 0.0), ('medium', 30.0), ('high', 60.0), ('critical', 85.0)]
RULE_SEVERITY = {'rapid_pass_through': 'high', 'high_fan_in': 'medium',
                 'high_fan_out': 'medium', 'burst_velocity': 'medium'}


def band_for(score: float, bands=DEFAULT_BANDS) -> str:
    band = 'low'
    for name, floor in bands:
        if score >= floor:
            band = name
    return band


def start_analysis(db: Session, *, dataset_id: str, model_version_id: str | None = None,
                   rule_thresholds: dict | None = None,
                   actor_ref: str = 'local-session') -> AnalysisRun:
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise ApiError(404, 'dataset_not_found', 'Unknown dataset id.')
    if dataset.source_type != 'current':
        raise ApiError(422, 'not_current',
                       'Analysis runs operate on current investigation datasets. Historical '
                       'training data is analysed only through the training workflow.')

    mv: ModelVersion | None = None
    if model_version_id:
        mv = db.get(ModelVersion, model_version_id)
        if mv is None:
            raise ApiError(404, 'model_not_found', 'Unknown model version id.')
        if mv.feature_version != FEATURE_VERSION:
            raise ApiError(409, 'feature_version_mismatch',
                           f'Model feature schema "{mv.feature_version}" is incompatible with the '
                           f'current pipeline "{FEATURE_VERSION}". Retrain explicitly or run the '
                           'labelled rule-based baseline.')
    else:
        mv = db.execute(select(ModelVersion).where(ModelVersion.active.is_(True))).scalars().first()

    run = AnalysisRun(id=str(uuid.uuid4()), dataset_id=dataset_id,
                      model_version_id=mv.id if mv else None, status='running')
    db.add(run)
    db.commit()
    try:
        _execute_analysis(db, run, dataset, mv, rule_thresholds or {})
    except ApiError:
        run.status = 'failed'
        db.commit()
        raise
    except Exception:
        run.status = 'failed'
        db.commit()
        raise ApiError(500, 'analysis_failed', 'Analysis failed unexpectedly; see run record.')

    db.add(AuditEvent(id=str(uuid.uuid4()), actor_ref=actor_ref, action='analysis_run',
                      target_type='analysis_run', target_id=run.id,
                      metadata_json=json.dumps({'dataset_id': dataset_id,
                                                'model_version_id': run.model_version_id})))
    db.commit()
    return run


def _execute_analysis(db: Session, run: AnalysisRun, dataset: Dataset,
                      mv: ModelVersion | None, thresholds: dict) -> None:
    accounts = db.execute(select(Account).where(Account.dataset_id == dataset.id)).scalars().all()
    if not accounts:
        run.status = 'completed'
        run.summary_json = json.dumps({
            'accounts_analysed': 0, 'method': 'none',
            'limitations': ['dataset has no accounts - honest empty result'],
            'scoring_version': SCORING_VERSION, 'rules_version': RULES_VERSION})
        db.commit()
        return

    feats = compute_account_features(db, dataset.id)
    pipe = None
    model_feature_names: list[str] | None = None
    if mv is not None:
        pipe = joblib.load(mv.artifact_path)
        # validate stored feature schema against the pipeline schema
        import os, json as _json
        meta_file = os.path.join(os.path.dirname(mv.artifact_path), 'metadata.json')
        if os.path.exists(meta_file):
            model_feature_names = _json.loads(open(meta_file).read()).get('feature_names')
        if model_feature_names != FEATURE_NAMES:
            raise ApiError(409, 'feature_version_mismatch',
                           'Model artifact feature names do not match the current pipeline schema.')

    thresholds_full = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    band_counts: dict[str, int] = {}
    findings_count = 0
    for acct in accounts:
        row = feats.get(acct.id)
        if row is None:
            continue
        triggered = evaluate_rules(row['features'], row['evidence'], thresholds_full)
        rule_fraction = len(triggered) / len(DEFAULT_THRESHOLDS) if DEFAULT_THRESHOLDS else 0.0
        warnings = list(row['warnings'])
        model_output: float | None = None
        if pipe is not None:
            vec = np.array([feature_vector(row['features'])])
            if hasattr(pipe.named_steps['model'], 'predict_proba'):
                model_output = float(pipe.predict_proba(vec)[0][1])
                warnings.append('model_output_uncalibrated: class-weighted model score, '
                                'not a validated fraud probability')
            else:  # IsolationForest: anomaly score normalised to 0..1 (higher = more anomalous)
                raw = -float(pipe.decision_function(vec)[0])
                model_output = float(1.0 / (1.0 + np.exp(-raw)))
                warnings.append('unsupervised_anomaly_score: not a verified fraud probability')
            score = 100.0 * (0.6 * model_output + 0.4 * rule_fraction)
            method = 'model+rules'
        else:
            score = 100.0 * rule_fraction
            method = 'rule_baseline'
            warnings.append('ml_model_unavailable: explicitly labelled rule-based baseline; '
                            'no trained model was used')
        score = round(min(max(score, 0.0), 99.9), 2)  # documented clamp; never displayed as 100
        band = band_for(score)
        band_counts[band] = band_counts.get(band, 0) + 1
        db.add(AccountAssessment(
            id=str(uuid.uuid4()), analysis_run_id=run.id, account_id=acct.id,
            score=score, band=band, method=f'{method} ({SCORING_VERSION})',
            indicators_json=json.dumps({
                'features': row['features'],
                'rules': triggered,
                'model_output': model_output,
                'rules_version': RULES_VERSION,
            }),
            warnings_json=json.dumps(warnings)))
        for trig in triggered:
            sev = RULE_SEVERITY.get(trig['rule'], 'low')
            db.add(Finding(
                id=str(uuid.uuid4()), analysis_run_id=run.id, type=trig['rule'],
                severity=sev, title=f"{trig['rule'].replace('_', ' ')} on account "
                                    f"{acct.external_account_ref}",
                explanation=(trig['reason'] + '. Indicator from deterministic rule '
                             f'{RULES_VERSION}; investigative lead for human review, '
                             'not a conclusion.'),
                status='open',
                evidence_refs_json=json.dumps({
                    'account_ref': acct.external_account_ref,
                    'account_id': acct.id,
                    'txn_refs': trig['evidence_txn_refs'],
                })))
            findings_count += 1

    run.status = 'completed'
    from datetime import datetime, timezone
    run.completed_at = datetime.now(timezone.utc)
    run.summary_json = json.dumps({
        'accounts_analysed': len(accounts),
        'band_distribution': band_counts,
        'findings_created': findings_count,
        'method': 'model+rules' if pipe is not None else 'rule_baseline',
        'model_version_id': mv.id if mv else None,
        'scoring_version': SCORING_VERSION,
        'rules_version': RULES_VERSION,
        'feature_version': FEATURE_VERSION,
        'rule_thresholds': thresholds_full,
        'limitations': [
            'Scores are triage signals from observed records, not legal conclusions.',
            'Model outputs are uncalibrated unless a calibrated model version is explicitly recorded.',
            'Rows missing recipient accounts limit multi-hop tracing.',
        ],
    })
    db.commit()
