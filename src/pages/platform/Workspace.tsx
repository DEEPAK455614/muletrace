// FR-01: dataset workspace - "Work on Previous Data" + "Insert Specific Dataset".
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, Upload, FlaskConical, PlayCircle, AlertTriangle } from 'lucide-react';
import { api, ApiError, type AnalysisRunRow, type DatasetRow } from '../../services/api';

export default function Workspace() {
  const [datasets, setDatasets] = React.useState<DatasetRow[] | null>(null);
  const [runs, setRuns] = React.useState<AnalysisRunRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const nav = useNavigate();

  React.useEffect(() => {
    Promise.all([api.datasets(), api.analysisRuns()])
      .then(([d, r]) => { setDatasets(d.datasets); setRuns(r.analysis_runs); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load workspace.'));
  }, []);

  if (err) return <div className="card state-box"><AlertTriangle size={18} className="mx-auto mb-2" />{err}</div>;
  if (!datasets || !runs) return <div className="card state-box">Loading workspace…</div>;

  return (
    <div className="grid gap-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <Database size={20} className="mb-2 text-brand" />
          <div className="text-[15px] font-bold mb-1">Work on Previous Data</div>
          <div className="text-[12.5px] text-ink-mute mb-3">Select a registered dataset or a previous analysis run. Nothing is overwritten.</div>
          {datasets.length === 0 ? (
            <div className="state-box">No datasets registered yet. Import a CSV to begin.</div>
          ) : (
            <div className="table-scroll"><table className="table-base">
              <thead><tr><th>Name</th><th>Type</th><th>Rows</th><th>Imported</th><th /></tr></thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.name}</td>
                    <td><span className="chip" style={{ borderColor: 'var(--color-line)' }}>{d.source_type}</span></td>
                    <td className="num">{d.row_counts?.accepted ?? 0}</td>
                    <td className="text-ink-mute text-[12px]">{d.created_at ? new Date(d.created_at).toLocaleString('en-IN') : '-'}</td>
                    <td>{d.source_type === 'current' && (
                      <button className="btn btn-primary !py-1 !px-2.5 !text-[11.5px]"
                        onClick={() => nav(`/platform/analyse/${d.id}`)}>
                        <PlayCircle size={13} /> Analyse
                      </button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
          {datasets.length > 0 && <div className="table-hint">Scroll sideways to see all columns.</div>}
        </div>
        <div className="grid gap-4 content-start">
          <div className="card p-5">
            <Upload size={20} className="mb-2 text-brand" />
            <div className="text-[15px] font-bold mb-1">Insert Specific Dataset</div>
            <div className="text-[12.5px] text-ink-mute mb-3">Guided upload: validate, review the column mapping, preview, then confirm import.</div>
            <Link to="/platform/upload" className="btn btn-primary no-underline">Upload CSV</Link>
            <Link to="/platform/training" className="btn no-underline ml-2"><FlaskConical size={14} /> Training</Link>
          </div>
          <div className="card p-5">
            <div className="text-[13px] font-bold mb-2">Previous analysis runs</div>
            {runs.length === 0 ? <div className="state-box">No analysis runs yet.</div> : (
              <div className="grid gap-1.5">
                {runs.slice(0, 8).map((r) => (
                  <Link key={r.id} to={`/platform/runs/${r.id}`} className="navpill !py-2 no-underline">
                    <span className="num text-[11px]">{r.id.slice(0, 8)}</span>
                    <span className="text-[11.5px] text-ink-mute">{r.summary?.method ?? r.status}</span>
                    <span className="ml-auto text-[11px] text-ink-mute">{r.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
