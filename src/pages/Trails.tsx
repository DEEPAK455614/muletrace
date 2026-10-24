import React, { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { traceTrail, traceComplaint, type TrailResult } from '../engine/trails';
import { SectionTitle, inrFull, fmtDateTime } from '../ui';
import { GitBranch } from 'lucide-react';

export default function Trails({ a }: { a: Analysis }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [account, setAccount] = useState(params.get('account') ?? '');
  const [dir, setDir] = useState<'forward' | 'backward'>('forward');
  const [days, setDays] = useState(30);
  const [complaintRef, setComplaintRef] = useState('');

  const trails: TrailResult[] = useMemo(() => {
    if (complaintRef.trim()) {
      const c = a.world.complaints.find((x) => x.ref.toLowerCase() === complaintRef.trim().toLowerCase());
      return c ? traceComplaint(a.world, c.id) : [];
    }
    if (!account.trim()) return [];
    return [traceTrail(a.world, account.trim(), dir, { windowDays: days })];
  }, [a, account, dir, days, complaintRef]);

  const merged = useMemo(() => {
    if (trails.length === 0) return null;
    // Dedupe hops by transaction id across seed trails - the same transaction
    // must never be counted twice when several complaints trace through it.
    const seen = new Set<string>();
    const hops = trails.flatMap((t) => t.hops).filter((h) => { if (seen.has(h.txnId)) return false; seen.add(h.txnId); return true; }).sort((x, y) => x.ts - y.ts);
    const endpoints = new Map<string, { id: string; kind: string; amount: number }>();
    trails.flatMap((t) => t.endpoints).forEach((e) => endpoints.set(e.id + e.kind, { id: e.id, kind: e.kind, amount: (endpoints.get(e.id + e.kind)?.amount ?? 0) + e.amount }));
    const totalTraced = hops.reduce((sum, h) => sum + h.amount, 0);
    const exitValue = [...endpoints.values()].reduce((sum, e) => sum + e.amount, 0);
    return { hops, endpoints: [...endpoints.values()], totalTraced, exitValue, maxDepth: Math.max(...trails.map((t) => t.maxDepth)) };
  }, [trails]);

  const nameOf = (id: string) => {
    if (id === 'ATM') return 'ATM (cash out)';
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };
  const kindLabel = (k: string) => k === 'cash-out' ? 'Cash withdrawal' : k === 'terminal-account' ? 'Terminal account' : 'Beyond window';

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Money-trail tracing</h1>
        <p className="text-[13px] text-ink-soft mt-1">Time-respecting paths: a hop only counts if the onward transaction happens after the inbound one. Trace forward from a victim or complaint to find exit points; backward from a suspect to find sources.</p>
      </div>

      <div className="card p-4 mb-4 no-print">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[11px] text-ink-mute block mb-1">Account ID</label>
            <input className="btn text-[12px] num w-40" value={account} onChange={(e) => { setAccount(e.target.value); setComplaintRef(''); }} placeholder="A1413" />
          </div>
          <div>
            <label className="text-[11px] text-ink-mute block mb-1">Direction</label>
            <select className="btn text-[12px]" value={dir} onChange={(e) => setDir(e.target.value as never)}>
              <option value="forward">Forward (where did money go)</option>
              <option value="backward">Backward (where did money come from)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-mute block mb-1">Window (days)</label>
            <select className="btn text-[12px]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[7, 14, 30, 90, 365].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="text-ink-mute text-[13px] px-1">or</div>
          <div>
            <label className="text-[11px] text-ink-mute block mb-1">Complaint reference</label>
            <input className="btn text-[12px] num w-48" value={complaintRef} onChange={(e) => { setComplaintRef(e.target.value); setAccount(''); }} placeholder="NCRP-2026-06-786977" />
          </div>
        </div>
      </div>

      {!merged && (
        <div className="card p-10 text-center">
          <GitBranch size={28} className="mx-auto text-ink-mute mb-2" />
          <div className="text-[14px] text-ink-soft">Enter an account ID or complaint reference to reconstruct the flow of funds.</div>
          <div className="text-[12px] text-ink-mute mt-1">Tip: open a complaint-named account from the alert queue, then "Trace funds".</div>
        </div>
      )}

      {merged && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card p-4"><div className="num text-[16px] md:text-[20px] font-semibold">{merged.hops.length}</div><div className="text-[11px] text-ink-mute">Hops reconstructed</div></div>
            <div className="card p-4"><div className="num text-[16px] md:text-[20px] font-semibold">{inrFull(merged.totalTraced)}</div><div className="text-[11px] text-ink-mute">Cumulative flow (distinct transactions)</div></div>
            <div className="card p-4"><div className="num text-[16px] md:text-[20px] font-semibold">{inrFull(merged.exitValue)}</div><div className="text-[11px] text-ink-mute">Terminal inbound total (hypothesis)</div></div>
            <div className="card p-4"><div className="num text-[16px] md:text-[20px] font-semibold">{merged.endpoints.length}</div><div className="text-[11px] text-ink-mute">Exit points (cash / terminal)</div></div>
          </div>
          <div className="text-[11px] text-ink-mute mb-4 -mt-2">Allocation follows FIFO time-ordering over observed transactions - a hypothesis, not proof of which rupee moved where. In circular flows the same funds pass repeatedly, so cumulative flow can exceed an account's genuine inflow. The terminal inbound total sums the full inbound amounts of hops that reach a stopping point; it is not a conserved trace of origin principal, and in branched or cyclic flows the same funds may be attributed to more than one sink. Neither number is a proven illicit amount.</div>
          <div style={{display:'none'}}>
          </div>

          {merged.endpoints.length > 0 && (
            <div className="card p-4 mb-4">
              <SectionTitle>Exit points - where the money leaves the traced network</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {merged.endpoints.map((x) => (
                  <span key={x.id + x.kind} className="chip" style={{ color: 'var(--color-risk-crit)', background: '#D92D2010', borderColor: '#D92D2035' }}>
                    {nameOf(x.id)} - {kindLabel(x.kind)} - <span className="num">{inrFull(x.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}


          {merged.hops.length > 0 && (() => {
            // Flow diagram: columns = hop depth, rows = accounts, edges = value
            const colOf = new Map<string, number>();
            const seed = account.trim() || merged.hops[0]?.from;
            if (seed) colOf.set(seed, 0);
            for (const h of merged.hops) {
              const c = colOf.get(h.from) ?? 0;
              if (!colOf.has(h.to) || (colOf.get(h.to) ?? 99) > c + 1) colOf.set(h.to, c + 1);
            }
            const byCol = new Map<number, string[]>();
            colOf.forEach((c, id) => byCol.set(c, [...(byCol.get(c) ?? []), id]));
            const cols = Math.max(...byCol.keys()) + 1;
            const W = 1000, rowH = 54, colW = Math.min(190, (W - 60) / Math.max(cols - 1, 1));
            const H = Math.max(...[...byCol.values()].map((v) => v.length)) * rowH + 60;
            const pos = new Map<string, { x: number; y: number }>();
            byCol.forEach((ids, c) => {
              const totalH = ids.length * rowH;
              ids.forEach((id, i) => pos.set(id, { x: 30 + c * colW, y: 30 + (H - 60 - totalH) / 2 + i * rowH + rowH / 2 }));
            });
            const maxAmt = Math.max(...merged.hops.map((h) => h.amount), 1);
            return (
              <div className="card p-4 mb-4">
                <SectionTitle>Flow diagram</SectionTitle>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2">
                  <defs>
                    <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0 L7,3.5 L0,7 z" fill="#B9B4A8" />
                    </marker>
                  </defs>
                  {merged.hops.map((h) => {
                    const a = pos.get(h.from)!, b = pos.get(h.to)!;
                    if (!a || !b) return null;
                    const mx = (a.x + b.x) / 2;
                    return (
                      <path key={h.txnId} d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                        fill="none" stroke="#B9B4A8" strokeWidth={1 + (h.amount / maxAmt) * 5} opacity={0.65} markerEnd="url(#arr)" />
                    );
                  })}
                  {[...pos.entries()].map(([id, p]) => {
                    const sc = a.scores.get(id);
                    const col = id === 'ATM' ? '#3A4152' : sc && sc.score >= 75 ? '#D92D20' : sc && sc.score >= 45 ? '#E0651F' : sc && sc.score >= 30 ? '#D99A1F' : '#8A93A3';
                    return (
                      <g key={id} className="cursor-pointer" onClick={() => id !== 'ATM' && nav(`/accounts/${id}`)}>
                        <circle cx={p.x} cy={p.y} r={7} fill={col} opacity={0.9} />
                        <text x={p.x + 11} y={p.y + 3.5} fontSize={10.5} fill="#3A4152" fontWeight={600}>{nameOf(id).split(' ')[0]}</text>
                        <text x={p.x + 11} y={p.y + 15} fontSize={8.5} fill="#8A93A3" fontFamily="var(--font-mono)">{id}</text>
                      </g>
                    );
                  })}
                </svg>
                <div className="text-[11px] text-ink-mute mt-1">Edge width = transaction value. Click a node for its 360 view.</div>
              </div>
            );
          })()}

          <div className="card overflow-x-auto">
            <table className="table-base min-w-[720px]">
              <thead><tr><th>Hop</th><th>Time</th><th>From</th><th>To</th><th className="text-right">Amount</th><th>Channel</th><th className="text-right">Dest. risk</th></tr></thead>
              <tbody>
                {merged.hops.map((h) => {
                  const s = a.scores.get(h.to);
                  return (
                    <tr key={h.txnId} className="rowlink" onClick={() => h.to !== 'ATM' && nav(`/accounts/${h.to}`)}>
                      <td className="num text-[11px]">{h.hop}</td>
                      <td className="num text-[11px] whitespace-nowrap">{fmtDateTime(h.ts)}</td>
                      <td className="text-[12px]">{nameOf(h.from)} <span className="num text-[10px] text-ink-mute">{h.from}</span></td>
                      <td className="text-[12px]">{nameOf(h.to)} <span className="num text-[10px] text-ink-mute">{h.to}</span></td>
                      <td className="num text-right text-[12px]">{inrFull(h.amount)}</td>
                      <td className="text-[12px] text-ink-soft">{h.channel}</td>
                      <td className="num text-right text-[12px]" style={{ color: s && s.score >= 45 ? 'var(--color-risk-crit)' : 'var(--color-ink-mute)' }}>{s ? s.score : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
