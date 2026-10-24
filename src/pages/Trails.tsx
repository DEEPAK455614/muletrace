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
    const hops = trails.flatMap((t) => t.hops).sort((x, y) => x.ts - y.ts);
    const endpoints = new Map<string, { id: string; kind: string; amount: number }>();
    trails.flatMap((t) => t.endpoints).forEach((e) => endpoints.set(e.id + e.kind, e));
    return { hops, endpoints: [...endpoints.values()], totalTraced: trails.reduce((s, t) => s + t.totalTraced, 0), maxDepth: Math.max(...trails.map((t) => t.maxDepth)) };
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
            <input className="btn text-[12px] num w-40" value={account} onChange={(e) => { setAccount(e.target.value); setComplaintRef(''); }} placeholder="AC-####" />
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
            <input className="btn text-[12px] num w-48" value={complaintRef} onChange={(e) => { setComplaintRef(e.target.value); setAccount(''); }} placeholder="NCRP-2026-####" />
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
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-4"><div className="num text-[20px] font-semibold">{merged.hops.length}</div><div className="text-[11px] text-ink-mute">Hops reconstructed</div></div>
            <div className="card p-4"><div className="num text-[20px] font-semibold">{inrFull(merged.totalTraced)}</div><div className="text-[11px] text-ink-mute">Value traced</div></div>
            <div className="card p-4"><div className="num text-[20px] font-semibold">{merged.endpoints.length}</div><div className="text-[11px] text-ink-mute">Exit points (cash / terminal)</div></div>
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
