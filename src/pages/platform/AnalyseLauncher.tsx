// Start an analysis run on a selected current dataset (FR-04 entry).
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlayCircle, AlertTriangle } from 'lucide-react';
import { api, ApiError, type ModelRow } from '../../services/api';

export default function AnalyseLauncher() {
  const { datasetId } = useParams();
  const [models, setModels] = React.useState<ModelRow[] | null>(null);
  const [choice, setChoice] = React.useState<string>('');
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const nav = useNavigate();

  React.useEffect(() => {
    api.models().then((m) => setModels(m.models))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load models.'));
  }, []);

  const start = async () => {
    if (!datasetId) return;
    setBusy(true); setErr(null);
    try {
      const run = await api.startAnalysis(datasetId, choice || undefined);
      nav(`/platform/runs/${run.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Analysis failed.');
    } finally { setBusy(false); }
  };

  if (err && !models) return <div className="card state-box"><AlertTriangle size={18} className="mx-auto mb-2" />{err}</div>;
  if (!models) return <div className="card state-box">Loading…</div>;
  const active = models.find((m) => m.active);

  return (
    <div className="card p-5 max-w-xl">
      <div className="text-[15px] font-bold mb-1">Run analysis</div>
      <div className="text-[12.5px] text-ink-mute mb-3">
        The chosen model scores each account; deterministic rules run alongside and stay separately explainable.
        Analysis never retrains the model.
      </div>
      <select className="btn !text-[12.5px] w-full mb-3" value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">{active ? `Active model ${active.id.slice(0, 8)} (${active.feature_version})` : 'No model - rule-based baseline (labelled)'}</option>
        {models.map((m) => <option key={m.id} value={m.id}>Model {m.id.slice(0, 8)} ({m.feature_version}){m.active ? ' - active' : ''}</option>)}
      </select>
      {models.length === 0 && (
        <div className="warn-text mb-3">No trained model exists. The run will use the explicitly labelled rule-based baseline.</div>
      )}
      <button className="btn btn-primary" disabled={busy} onClick={start}>
        <PlayCircle size={14} /> {busy ? 'Analysing…' : 'Start analysis'}
      </button>
      {err && <div className="err-text mt-3">{err}</div>}
    </div>
  );
}
