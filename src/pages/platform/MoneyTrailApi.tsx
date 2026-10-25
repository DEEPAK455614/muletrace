// FR-06: money trail - bounded graph slice + forward/backward temporal tracing.
import React from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { api, ApiError, type GraphSlice, type TraceResult } from '../../services/api';

export default function MoneyTrailApi() {
  const { runId } = useParams();
  const [graph, setGraph] = React.useState<GraphSlice | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [accountRef, setAccountRef] = React.useState('');
  const [direction, setDirection] = React.useState<'forward' | 'backward'>('forward');
  const [hops, setHops] = React.useState(3);
  const [minAmt, setMinAmt] = React.useState('');
  const [trace, setTrace] = React.useState<TraceResult | null>(null);
  const [traceErr, setTraceErr] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!runId) return;
    api.graph(runId).then(setGraph)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load graph.'));
  }, [runId]);

  const runTrace = async () => {
    if (!runId || !accountRef.trim()) return;
    setTraceErr(null); setTrace(null);
    try {
      setTrace(await api.trace(runId, {
        account_ref: accountRef.trim(), direction, max_hops: hops,
        min_amount: minAmt ? Number(minAmt) : undefined,
      }));
    } catch (e) { setTraceErr(e instanceof ApiError ? e.message : 'Trace failed.'); }
  };

  if (err) return <div className="card state-box"><AlertTriangle size={18} className="mx-auto mb-2" />{err}</div>;
  if (!graph) return <div className="card state-box">Loading graph…</div>;

  const selEdges = sel ? graph.edges.filter((e) => e.txn_ref === sel) : [];

  return (
    <div className="grid gap-4">
      <div className="card p-5">
        <div className="text-[15px] font-bold mb-1">Money trail</div>
        <div className="text-[12px] text-ink-mute mb-3">{graph.note}</div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input className="btn !py-1.5 !text-[12.5px] w-44" placeholder="Account ref (e.g. ACC-123)"
            value={accountRef} onChange={(e) => setAccountRef(e.target.value)} />
          <select className="btn !py-1.5 !text-[12.5px]" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
            <option value="forward">Forward - where funds went</option>
            <option value="backward">Backward - where funds came from</option>
          </select>
          <label className="text-[12px] flex items-center gap-1.5">Hops
            <select className="btn !py-1.5 !text-[12.5px]" value={hops} onChange={(e) => setHops(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
          <input className="btn !py-1.5 !text-[12.5px] w-28 num" placeholder="Min amount" value={minAmt}
            onChange={(e) => setMinAmt(e.target.value.replace(/[^0-9.]/g, ''))} />
          <button className="btn btn-primary !py-1.5 !text-[12.5px]" onClick={runTrace} disabled={!accountRef.trim()}>Trace</button>
        </div>
        {traceErr && <div className="err-text mb-2">{traceErr}</div>}

        {graph.honest_empty ? (
          <div className="state-box">No transaction edges in this dataset{graph.truncated ? '' : ' within the current filters'}. The graph is honestly empty - no sample data is substituted.</div>
        ) : (
          <div className="table-scroll"><table className="table-base">
            <thead><tr><th>From</th><th>To</th><th>Amount</th><th>Time (UTC)</th><th>Txn ref</th></tr></thead>
            <tbody>{graph.edges.slice(0, 100).map((e, k) => (
              <tr key={k} className="rowlink" onClick={() => setSel(e.txn_ref)}>
                <td className="num text-[12px]">{graph.nodes.find((n) => n.id === e.source)?.external_ref ?? e.source}</td>
                <td className="num text-[12px]">{graph.nodes.find((n) => n.id === e.target)?.external_ref ?? e.target}</td>
                <td className="num">{e.amount.toLocaleString('en-IN')} {e.currency}</td>
                <td className="text-[11.5px] text-ink-mute">{new Date(e.ts).toLocaleString('en-IN')}</td>
                <td className="num text-[11.5px]">{e.txn_ref}</td>
              </tr>))}
            </tbody>
          </table></div>
        )}
        {graph.truncated && <div className="warn-text mt-2">Graph slice capped at the configured edge limit; refine filters to narrow.</div>}
        {sel && selEdges.length > 0 && (
          <div className="mt-3 border border-[var(--color-line)] rounded-xl p-3 text-[12.5px]">
            <b>Source transaction {sel}</b>: {selEdges[0].amount.toLocaleString('en-IN')} {selEdges[0].currency} at {new Date(selEdges[0].ts).toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {trace && (
        <div className="card p-5">
          <div className="text-[13px] font-bold mb-1">
            {trace.direction === 'forward' ? 'Forward' : 'Backward'} trace from <span className="num">{trace.origin.external_ref}</span>
          </div>
          <div className="text-[12px] text-ink-mute mb-3">{trace.note}</div>
          {trace.path_count === 0 ? (
            <div className="state-box">No matching paths within {trace.max_hops} hop(s) and the current filters.</div>
          ) : (
            <div className="grid gap-2">
              {trace.paths.map((p, i) => (
                <div key={i} className="border border-[var(--color-line)] rounded-xl p-3 text-[12.5px]">
                  <span className="text-ink-mute text-[11px] font-semibold">Path {i + 1} ({p.length} hop{p.length > 1 ? 's' : ''})</span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {p.map((s, j) => (
                      <React.Fragment key={j}>
                        {j === 0 && <span className="num font-semibold">{s.from_ref}</span>}
                        <span className="text-ink-mute">-&gt; <span className="num">{s.amount.toLocaleString('en-IN')}</span> <span className="text-[10.5px]">({s.txn_ref})</span> -&gt;</span>
                        <span className="num font-semibold">{s.to_ref}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
              {trace.paths_capped && <div className="warn-text">Result capped; narrow with amount/time filters.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
