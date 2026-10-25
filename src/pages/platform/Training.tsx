// FR-02: historical training - dataset picker, explicit train action, evaluation metadata.
import React from 'react';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { api, ApiError, type DatasetRow, type ModelRow, type TrainingRunRow } from '../../services/api';

export default function Training() {
  const [datasets, setDatasets] = React.useState<DatasetRow[] | null>(null);
  const [runs, setRuns] = React.useState<TrainingRunRow[] | null>(null);
  const [models, setModels] = React.useState<ModelRow[] | null>(null);
  const [selected, setSelected] = React.useState<string>('');
  const [algorithm, setAlgorithm] = React.useState('logistic_regression');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    Promise.all([api.datasets(), api.trainingRuns(), api.models()])
      .then(([d, r, m]) => {
        setDatasets(d.datasets.filter((x) => x.source_type === 'historical'));
        setRuns(r.training_runs); setModels(m.models);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load.'));
  }, []);
  React.useEffect(reload, [reload]);

  const train = async () => {
    if (!selected) return;
    if (!window.confirm('Start training on the selected historical dataset? This fits a new model version.')) return;
    setBusy(true); setErr(null);
    try { await api.train([selected], algorithm, {}); reload(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Training failed.'); }
    finally { setBusy(false); }
  };

  if (err && !datasets) return <div className="card state-box"><AlertTriangle size={18} className="mx-auto mb-2" />{err}</div>;
  if (!datasets || !runs || !models) return <div className="card state-box">Loading training workspace…</div>;

  return (
    <div className="grid gap-4 max-w-4xl">
      <div className="card p-5">
        <div className="text-[15px] font-bold mb-1">Historical training</div>
        <div className="text-[12.5px] text-ink-mute mb-3">
          Training uses only datasets registered as historical. Current investigation data is never mixed in.
          Splits are deterministic (60/20/20 train/dev/holdout, fixed seed); the holdout is evaluated once and never tuned.
        </div>
        {datasets.length === 0 ? (
          <div className="state-box">No historical datasets registered. Import one via "Insert Specific Dataset" with type "Historical training data".</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select className="btn !text-[12.5px]" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select historical dataset…</option>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.row_counts?.accepted ?? 0} rows)</option>)}
            </select>
            <select className="btn !text-[12.5px]" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              <option value="logistic_regression">Logistic regression (interpretable baseline)</option>
              <option value="random_forest">Random forest</option>
              <option value="isolation_forest">Isolation forest (unsupervised; anomaly score only)</option>
            </select>
            <button className="btn btn-primary" disabled={!selected || busy} onClick={train}>
              <FlaskConical size={14} /> {busy ? 'Training…' : 'Train model'}
            </button>
          </div>
        )}
        {err && <div className="err-text mt-3">{err}</div>}
      </div>

      <div className="card p-5">
        <div className="text-[13px] font-bold mb-2">Model versions</div>
        {models.length === 0 ? <div className="state-box">No trained models yet.</div> : (
          <div className="table-scroll"><table className="table-base">
            <thead><tr><th>Version</th><th>Feature schema</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>{models.map((m) => (
              <tr key={m.id}>
                <td className="num text-[12px]">{m.id.slice(0, 8)}</td>
                <td className="num text-[12px]">{m.feature_version}</td>
                <td>{m.active ? <span className="band-pill band-low">active</span> : <span className="text-ink-mute text-[12px]">superseded</span>}</td>
                <td className="text-[12px] text-ink-mute">{new Date(m.created_at).toLocaleString('en-IN')}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card p-5">
        <div className="text-[13px] font-bold mb-2">Training history</div>
        {runs.length === 0 ? <div className="state-box">No training runs yet.</div> : (
          <div className="grid gap-3">{runs.map((r) => (
            <div key={r.id} className="border border-[var(--color-line)] rounded-xl p-3.5">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="num text-[11.5px]">{r.id.slice(0, 8)}</span>
                <span className="chip" style={{ borderColor: 'var(--color-line)' }}>{r.algorithm}</span>
                <span className="chip" style={{ borderColor: 'var(--color-line)' }}>{r.feature_version}</span>
                <span className={`band-pill ${r.status === 'completed' ? 'band-low' : 'band-critical'}`}>{r.status}</span>
                <span className="ml-auto text-[11.5px] text-ink-mute">{new Date(r.created_at).toLocaleString('en-IN')}</span>
              </div>
              {r.metrics?.mode === 'supervised' && (
                <div className="text-[12px] text-ink-soft grid gap-0.5">
                  <div>Split: train {r.metrics.split?.train}, dev {r.metrics.split?.dev}, holdout {r.metrics.split?.holdout}</div>
                  <div>Dev: F1 {r.metrics.dev?.f1?.toFixed(3)}, precision {r.metrics.dev?.precision?.toFixed(3)}, recall {r.metrics.dev?.recall?.toFixed(3)}{r.metrics.dev?.pr_auc != null ? `, PR-AUC ${r.metrics.dev.pr_auc.toFixed(3)}` : ''}</div>
                  <div>Holdout (single evaluation, never tuned): F1 {r.metrics.holdout?.f1?.toFixed(3)}, precision {r.metrics.holdout?.precision?.toFixed(3)}, recall {r.metrics.holdout?.recall?.toFixed(3)}{r.metrics.holdout?.pr_auc != null ? `, PR-AUC ${r.metrics.holdout.pr_auc.toFixed(3)}` : ''}</div>
                  <div className="text-[11.5px] text-ink-mute mt-1">
                    Limits of this run: metrics describe only this imported dataset on a deterministic random
                    split (not temporal); graph features are transductive (computed over the full dataset before
                    splitting); scores are uncalibrated and are not fraud probabilities.
                  </div>
                </div>
              )}
              {r.metrics?.mode === 'unsupervised' && (
                <div className="warn-text">Unsupervised anomaly model - scores are anomaly indicators, not fraud probabilities.</div>
              )}
              {r.metrics?.error && <div className="err-text">{r.metrics.error}</div>}
              {(r.metrics?.warnings ?? []).map((w: string, k: number) => <div key={k} className="warn-text">{w}</div>)}
            </div>))}
          </div>
        )}
      </div>
    </div>
  );
}
