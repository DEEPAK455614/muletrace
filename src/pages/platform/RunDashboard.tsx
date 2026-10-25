// FR-05: investigation dashboard for one persisted analysis run.
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, FileDown, GitBranch, ListChecks } from 'lucide-react';
import { api, ApiError, type AnalysisRunRow, type Assessment, type FindingRow } from '../../services/api';

export default function RunDashboard() {
  const { runId } = useParams();
  const [run, setRun] = React.useState<AnalysisRunRow | null>(null);
  const [assessments, setAssessments] = React.useState<Assessment[] | null>(null);
  const [findings, setFindings] = React.useState<FindingRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!runId) return;
    Promise.all([api.run(runId), api.assessments(runId), api.findings(runId)])
      .then(([r, a, f]) => { setRun(r); setAssessments(a.assessments); setFindings(f.findings); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load run.'));
  }, [runId]);

  if (err) return <div className="card state-box"><AlertTriangle size={18} className="mx-auto mb-2" />{err}</div>;
  if (!run || !assessments || !findings) return <div className="card state-box">Loading analysis run…</div>;

  const bands = run.summary?.band_distribution ?? {};
  const flagged = assessments.filter((a) => a.band === 'high' || a.band === 'critical');
  const kpis: [string, string | number][] = [
    ['Accounts analysed', run.summary?.accounts_analysed ?? 0],
    ['Findings', run.summary?.findings_created ?? 0],
    ['High + critical', flagged.length],
    ['Method', run.summary?.method ?? '-'],
  ];

  return (
    <div className="grid gap-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="text-[15px] font-bold">Analysis run <span className="num">{run.id.slice(0, 8)}</span></div>
          <span className={`band-pill ${run.status === 'completed' ? 'band-low' : 'band-critical'}`}>{run.status}</span>
          <span className="text-[11.5px] text-ink-mute">dataset <span className="num">{run.dataset_id.slice(0, 8)}</span> · model {run.model_version_id ? <span className="num">{run.model_version_id.slice(0, 8)}</span> : 'none (rule baseline)'}</span>
          <span className="ml-auto flex gap-2">
            <Link className="btn !py-1.5 !text-[12px] no-underline" to={`/platform/runs/${run.id}/trail`}><GitBranch size={13} /> Money trail</Link>
            <Link className="btn !py-1.5 !text-[12px] no-underline" to={`/platform/runs/${run.id}/findings`}><ListChecks size={13} /> Findings</Link>
            <a className="btn btn-primary !py-1.5 !text-[12px] no-underline" href={api.reportUrl(run.id)} target="_blank" rel="noreferrer"><FileDown size={13} /> PDF report</a>
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map(([label, value]) => (
            <div key={label} className="kpi border border-[var(--color-line)] rounded-xl p-3">
              <span className="kpi-label">{label}</span>
              <span className="kpi-value">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="kpi-label">Risk distribution</span>
          {(['critical', 'high', 'medium', 'low'] as const).map((b) => (
            <span key={b} className={`band-pill band-${b}`}>{b}: <span className="num">{bands[b] ?? 0}</span></span>
          ))}
        </div>
        {(run.summary?.limitations ?? []).length > 0 && (
          <div className="mt-3 grid gap-0.5">
            {run.summary.limitations!.map((l, k) => <div key={k} className="warn-text">Limitation: {l}</div>)}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="text-[13px] font-bold mb-2">Account assessments (by triage score)</div>
        {assessments.length === 0 ? <div className="state-box">No accounts in this run.</div> : (
          <div className="table-scroll"><table className="table-base">
            <thead><tr><th>Account</th><th>Score</th><th>Band</th><th>Method</th><th>Triggered indicators</th><th>Warnings</th></tr></thead>
            <tbody>{assessments.slice(0, 50).map((a) => (
              <tr key={a.account_id}>
                <td className="num text-[12px] font-semibold">{a.account_ref}</td>
                <td className="num">{a.score.toFixed(1)}</td>
                <td><span className={`band-pill band-${a.band}`}>{a.band}</span></td>
                <td className="text-[11.5px] text-ink-mute">{a.method}</td>
                <td className="text-[11.5px]">{(a.indicators.rules ?? []).map((r) => r.rule).join(', ') || '-'}</td>
                <td className="text-[11px] text-ink-mute max-w-[220px]">{a.warnings.join('; ') || '-'}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
