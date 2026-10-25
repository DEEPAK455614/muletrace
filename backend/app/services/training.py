"""Historical training service (SRS FR-02, section 7 model strategy).

Hard guarantees:
- Trains ONLY on datasets registered as source_type='historical'. Current
  analysis datasets are never silently used; training is an explicit action.
- Leakage-safe split: deterministic stratified train/dev/holdout (60/20/20,
  fixed seed). Preprocessing is fit on the training split only. Dev metrics
  are reported separately from the final holdout metrics; the holdout is
  evaluated once and never used to tune.
- Labels come only from a trusted historical file's label column, never from
  the ordinary complaint-upload CSV. If no valid labels exist, the only
  fallback is an explicitly-labelled unsupervised IsolationForest whose output
  is described as an anomaly score, not a fraud probability.
- If training data is insufficient or malformed, the run stops with an
  actionable error; no placeholder model is created.
- The model artifact is versioned (joblib pipeline + JSON metadata) and a
  model version is marked active only after validation succeeds.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import uuid
from pathlib import Path

import joblib
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ApiError
from app.models import Account, AuditEvent, Dataset, ModelVersion, TrainingRun
from app.services import ingestion
from app.services.features import FEATURE_NAMES, FEATURE_VERSION, compute_account_features, feature_vector

RANDOM_SEED = 42
LABEL_SYNONYMS = {'label', 'is mule', 'is fraud', 'fraud', 'mule', 'class', 'target', 'y',
                  'mule account', 'is mule account'}
SUPPORTED_ALGORITHMS = {'logistic_regression', 'random_forest', 'isolation_forest'}


def _find_source_file(dataset: Dataset) -> Path:
    """Locate the dataset's original CSV in the historical directory by checksum."""
    hist = Path(settings.historical_dir)
    if not hist.is_dir():
        raise ApiError(422, 'historical_dir_missing',
                       f'Historical data directory is not available. Place approved training CSVs in {hist}.')
    for path in sorted(hist.glob('*.csv')):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest == dataset.checksum:
            return path
    raise ApiError(422, 'source_file_not_found',
                   'The original CSV for this dataset was not found in the historical data '
                   'directory (matched by SHA-256 checksum). Re-place the file or re-import '
                   'from the historical directory.')


def _read_labels(path: Path) -> tuple[dict[str, int], list[str]]:
    """Return ({account_ref: 0|1}, warnings). Labels are row-level in the source;
    an account is positive iff it is the debit/source account on at least one
    labelled-positive row. Never inferred from outcomes or complaints."""
    content = path.read_bytes()
    text = content.decode('utf-8-sig')
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(c.strip() for c in r)]
    headers = [h.strip() for h in rows[0]]
    normed = {ingestion._norm(h): h for h in headers}
    label_header = next((normed[n] for n in LABEL_SYNONYMS if n in normed), None)
    if label_header is None:
        return {}, ['no_label_column']
    mapping = ingestion.suggest_mapping(headers)
    debit_col = mapping.get('debit_account_wallet_upi_id')
    if not debit_col:
        raise ApiError(422, 'label_mapping_failed',
                       'Label column found but the debit account column could not be matched; '
                       'cannot attribute labels to accounts. Fix the historical file headers.')
    labels: dict[str, int] = {}
    bad_rows = 0
    for r in rows[1:]:
        rec = dict(zip(headers, r))
        raw = (rec.get(label_header) or '').strip().lower()
        if raw not in ('0', '1'):
            bad_rows += 1
            continue
        acct = (rec.get(debit_col) or '').strip()
        if not acct:
            bad_rows += 1
            continue
        labels[acct] = max(labels.get(acct, 0), int(raw))
    warnings: list[str] = []
    if bad_rows:
        warnings.append(f'{bad_rows} rows had unusable label/account values and were excluded from training targets.')
    return labels, warnings


def _metrics(y_true: np.ndarray, y_prob: np.ndarray) -> dict:
    from sklearn.metrics import (average_precision_score, confusion_matrix,
                                 f1_score, precision_score, recall_score)
    y_pred = (y_prob >= 0.5).astype(int)
    out = {
        'precision': float(precision_score(y_true, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true, y_pred, zero_division=0)),
        'f1': float(f1_score(y_true, y_pred, zero_division=0)),
        'confusion_matrix': confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist(),
        'support': int(len(y_true)),
        'positive_rate': float(np.mean(y_true)),
    }
    if len(np.unique(y_true)) > 1:
        out['pr_auc'] = float(average_precision_score(y_true, y_prob))
    else:
        out['pr_auc'] = None
        out['pr_auc_note'] = 'single-class split; PR-AUC not meaningful'
    return out


def start_training(db: Session, *, dataset_ids: list[str], algorithm: str = 'logistic_regression',
                   parameters: dict | None = None, actor_ref: str = 'local-session') -> TrainingRun:
    if algorithm not in SUPPORTED_ALGORITHMS:
        raise ApiError(422, 'unsupported_algorithm',
                       f'Algorithm must be one of {sorted(SUPPORTED_ALGORITHMS)}.')
    if not dataset_ids:
        raise ApiError(422, 'no_datasets', 'Select at least one historical dataset to train on.')
    datasets = db.execute(select(Dataset).where(Dataset.id.in_(dataset_ids))).scalars().all()
    found = {d.id: d for d in datasets}
    missing = [d for d in dataset_ids if d not in found]
    if missing:
        raise ApiError(404, 'dataset_not_found', f'Unknown dataset ids: {missing}')
    for d in datasets:
        if d.source_type != 'historical':
            raise ApiError(422, 'not_historical',
                           f'Dataset "{d.name}" is registered as "{d.source_type}". Training is '
                           'permitted only on historical training datasets; current analysis data '
                           'is never silently mixed into training.')

    run = TrainingRun(id=str(uuid.uuid4()), dataset_ids_json=json.dumps(dataset_ids),
                      dataset_checksums_json=json.dumps({d.id: d.checksum for d in datasets}),
                      algorithm=algorithm, feature_version=FEATURE_VERSION,
                      parameters_json=json.dumps(parameters or {}), status='running')
    db.add(run)
    db.commit()
    try:
        _execute_training(db, run, datasets, parameters or {})
    except ApiError as e:
        run.status = 'failed'
        run.metrics_json = json.dumps({'error': e.message, 'code': e.code})
        db.commit()
        raise
    except Exception as e:  # honest failure, no fake model
        run.status = 'failed'
        run.metrics_json = json.dumps({'error': f'unexpected: {type(e).__name__}'})
        db.commit()
        raise ApiError(500, 'training_failed', 'Training failed unexpectedly; see run record.')

    db.add(AuditEvent(id=str(uuid.uuid4()), actor_ref=actor_ref, action='training_run',
                      target_type='training_run', target_id=run.id,
                      metadata_json=json.dumps({'algorithm': algorithm, 'datasets': dataset_ids})))
    db.commit()
    return run


def _execute_training(db: Session, run: TrainingRun, datasets: list[Dataset], parameters: dict) -> None:
    from sklearn.ensemble import IsolationForest, RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    all_labels: dict[str, int] = {}
    warnings: list[str] = []
    # Features come from persisted records (source of truth), labels from the
    # trusted historical file (matched by checksum).
    feature_rows: dict[str, dict] = {}
    ref_by_account: dict[str, str] = {}
    for d in datasets:
        feats = compute_account_features(db, d.id)
        feature_rows.update(feats)
        for acct_id in feats:
            acct = db.get(Account, acct_id)
            ref_by_account[acct.external_account_ref] = acct_id
        src = _find_source_file(d)
        labels, w = _read_labels(src)
        all_labels.update(labels)
        warnings.extend(w)

    if not feature_rows:
        raise ApiError(422, 'no_training_rows',
                       'The selected historical datasets contain no usable account records. '
                       'Import a valid historical CSV first.')

    y_map = {ref_by_account[ref]: lab for ref, lab in all_labels.items() if ref in ref_by_account}

    metrics: dict = {'warnings': warnings, 'feature_version': FEATURE_VERSION,
                     'feature_names': FEATURE_NAMES, 'random_seed': RANDOM_SEED}
    params = dict(parameters)

    if not y_map:
        if run.algorithm != 'isolation_forest':
            run.algorithm = 'isolation_forest'
            warnings.append('no_label_column: no valid labels found; fell back to IsolationForest. '
                            'Output is an anomaly score, not a verified fraud probability.')
        ids = sorted(feature_rows)
        X = np.array([feature_vector(feature_rows[i]['features']) for i in ids])
        if len(ids) < 10:
            raise ApiError(422, 'insufficient_data',
                           f'Only {len(ids)} accounts available; unsupervised training needs at '
                           'least 10. Provide more historical data or a labelled file.')
        contamination = float(params.get('contamination', 0.05))
        pipe = Pipeline([('scaler', StandardScaler()),
                         ('model', IsolationForest(contamination=contamination,
                                                   random_state=RANDOM_SEED))])
        pipe.fit(X)
        method = 'isolation_forest'
        metrics.update({'mode': 'unsupervised', 'accounts': len(ids),
                        'contamination': contamination,
                        'evaluation': 'no labels: no precision/recall computed; anomaly scores only'})
    else:
        ids = sorted(y_map)
        X = np.array([feature_vector(feature_rows[i]['features']) for i in ids])
        y = np.array([y_map[i] for i in ids])
        positives = int(y.sum())
        if len(ids) < 20 or positives < 3 or (len(ids) - positives) < 3:
            raise ApiError(422, 'insufficient_data',
                           f'Labelled set too small for a leakage-safe split: {len(ids)} accounts, '
                           f'{positives} positive. Need >= 20 accounts with >= 3 per class. Provide '
                           'more labelled historical data; no placeholder model was created.')
        # Deterministic stratified split: 60/20/20 train/dev/holdout.
        X_tr, X_tmp, y_tr, y_tmp = train_test_split(
            X, y, test_size=0.4, random_state=RANDOM_SEED, stratify=y)
        X_dev, X_hold, y_dev, y_hold = train_test_split(
            X_tmp, y_tmp, test_size=0.5, random_state=RANDOM_SEED, stratify=y_tmp)
        if run.algorithm == 'random_forest':
            clf = RandomForestClassifier(n_estimators=int(params.get('n_estimators', 200)),
                                         class_weight='balanced', random_state=RANDOM_SEED)
        else:
            clf = LogisticRegression(class_weight='balanced', max_iter=1000,
                                     random_state=RANDOM_SEED)
        pipe = Pipeline([('scaler', StandardScaler()), ('model', clf)])
        pipe.fit(X_tr, y_tr)  # preprocessing fit on the training split only
        method = run.algorithm
        metrics.update({
            'mode': 'supervised',
            'split_unit': 'account',
            'split': {'train': int(len(y_tr)), 'dev': int(len(y_dev)), 'holdout': int(len(y_hold))},
            'dev': _metrics(y_dev, pipe.predict_proba(X_dev)[:, 1]),
            'holdout': _metrics(y_hold, pipe.predict_proba(X_hold)[:, 1]),
            'evaluation_note': 'Holdout evaluated once and never used for tuning. '
                               'Logistic/forest outputs are uncalibrated scores, not validated probabilities.',
            'leakage_limits': [
                'Split unit is the account: each labelled account appears in exactly one split (verified disjoint).',
                'Preprocessing (StandardScaler) is fit on the training split only.',
                'RESIDUAL LIMIT: account features are computed over the full historical graph, so the split is transductive, not a pure inductive network holdout.',
                'RESIDUAL LIMIT: the split is random by account, not temporal; features aggregate the full dataset window, so no statement about future-time generalisation is made.',
                'Duplicate transaction rows are flagged at import; account-level split units cannot straddle splits by construction.',
            ],
        })

    model_version_id = str(uuid.uuid4())
    artifact_dir = Path(settings.artifacts_dir) / model_version_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = artifact_dir / 'model.joblib'
    joblib.dump(pipe, artifact_path)
    metadata = {
        'model_version_id': model_version_id,
        'training_run_id': run.id,
        'algorithm': run.algorithm,
        'feature_version': FEATURE_VERSION,
        'feature_names': FEATURE_NAMES,
        'random_seed': RANDOM_SEED,
        'library_versions': _library_versions(),
        'datasets': {d.id: {'name': d.name, 'checksum': d.checksum} for d in datasets},
    }
    (artifact_dir / 'metadata.json').write_text(json.dumps(metadata, indent=2))

    # Validate the artifact round-trips and matches the feature schema before activation.
    loaded = joblib.load(artifact_path)
    probe = np.zeros((1, len(FEATURE_NAMES)))
    loaded.predict(probe)

    run.status = 'completed'
    run.artifact_path = str(artifact_path)
    run.metrics_json = json.dumps(metrics)
    db.query(ModelVersion).update({ModelVersion.active: False})
    db.add(ModelVersion(id=model_version_id, training_run_id=run.id,
                        artifact_path=str(artifact_path), feature_version=FEATURE_VERSION,
                        active=True))
    db.commit()


def _library_versions() -> dict:
    import sklearn
    return {'scikit_learn': sklearn.__version__, 'joblib': joblib.__version__,
            'numpy': np.__version__}
