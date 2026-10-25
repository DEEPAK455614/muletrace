// FR-07: findings with evidence refs, acknowledge/resolve, analyst notes.
import React from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { api, ApiError, type FindingRow } from '../../services/api';

const SEV_CLASS: Record<string, string> = { high: 'band-critical', medium: 'band-high', low: 'band-low' };

export default function FindingsApi() {
  const { runId } = useParams();
  const [findings, setFindings] = React.useState<FindingRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [noteFor, setNoteFor] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');

  const reload = React.useCallback(() => {
    if (!runId) return;
    api.findings(runId).then((f) => setFindings(f.findings))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load findings.'));
  }, [runId]);
  React.useEffect(reload, [reload]);

  const setStatus = async (id: string, status: string) => {
    try { await api.setFindingStatus(id, status); reload(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Update failed.'); }
  };
  const saveNote = async () => {
    if (!noteFor || !note.trim()) return;
    try { await api.addNote(noteFor, note.trim()); setNote(''); setNoteFor(null); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Note failed.'); }
  };

  if (err && !findings) return <div className="card state-box"><AlertTriangle size={18} className="mx-auto mb-2" />{err}</div>;
  if (!findings) return <div className="card state-box">Loading findings…</div>;

  return (
    <div className="grid gap-3 max-w-4xl">
      <div className="text-[12px] text-ink-mute">
        Findings originate from deterministic rules, model output, or recorded analyst action. They are investigative leads, not conclusions.
      </div>
      {err && <div className="err-text">{err}</div>}
      {findings.length === 0 && <div className="card state-box">No findings in this run. No matching evidence found.</div>}
      {findings.map((f) => (
        <div key={f.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`band-pill ${SEV_CLASS[f.severity] ?? 'band-medium'}`}>{f.severity}</span>
            <span className="text-[13px] font-bold">{f.title}</span>
            <span className="chip ml-auto" style={{ borderColor: 'var(--color-line)' }}>{f.status}</span>
          </div>
          <div className="text-[12.5px] text-ink-soft mb-2">{f.explanation}</div>
          <div className="text-[11.5px] text-ink-mute mb-2">
            Account <span className="num">{f.evidence?.account_ref ?? '-'}</span>
            {(f.evidence?.txn_refs?.length ?? 0) > 0 && <> · evidence txns: <span className="num">{f.evidence.txn_refs!.slice(0, 6).join(', ')}</span></>}
            {' '}· {new Date(f.created_at).toLocaleString('en-IN')}
          </div>
          <div className="flex flex-wrap gap-2">
            {f.status === 'open' && <button className="btn !py-1 !text-[11.5px]" onClick={() => setStatus(f.id, 'acknowledged')}>Acknowledge</button>}
            {f.status !== 'resolved' && <button className="btn !py-1 !text-[11.5px]" onClick={() => setStatus(f.id, 'resolved')}>Resolve</button>}
            <button className="btn !py-1 !text-[11.5px]" onClick={() => setNoteFor(noteFor === f.id ? null : f.id)}>Add note</button>
          </div>
          {noteFor === f.id && (
            <div className="mt-2 flex gap-2">
              <input className="btn !py-1 !text-[12px] flex-1" placeholder="Investigation note (persisted, auditable)"
                value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-primary !py-1 !text-[12px]" onClick={saveNote}>Save</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
