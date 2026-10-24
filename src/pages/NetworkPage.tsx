import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inr, inrFull, fmtDate, fmtDateTime } from '../ui';
import FlowGraph, { buildCommunities, buildLayout, BAND_FILL } from '../components/FlowGraph';

export default function NetworkPage({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const communities = useMemo(() => buildCommunities(a), [a]);

  const [selected, setSelected] = useState<number | null>(communities[0]?.cid ?? null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<{ from: string; to: string } | null>(null);
  const sel = communities.find((c) => c.cid === selected);

  const layout = useMemo(() => (sel ? buildLayout(a, sel.members) : null), [a, sel]);

  const nameOf = (id: string) => {
    if (id === 'ATM') return 'ATM (cash out)';
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };

  const edgeDetail = useMemo(() => {
    if (!selEdge || !sel) return null;
    const txns = a.world.txns.filter((t) => t.from === selEdge.from && t.to === selEdge.to).sort((x, y) => y.ts - x.ts);
    const total = txns.reduce((sum, t) => sum + t.amount, 0);
    return { txns: txns.slice(0, 8), count: txns.length, total };
  }, [a, selEdge, sel]);

  const nodeDetail = useMemo(() => {
    if (!selNode) return null;
    const sc = a.scores.get(selNode);
    const f = a.features.get(selNode);
    const acc = a.world.accounts.find((x) => x.id === selNode);
    const nm = a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? selNode;
    const complaints = a.world.complaints.filter((c) => c.namedAccountIds.includes(selNode));
    return { sc, f, acc, nm, complaints };
  }, [a, selNode]);

  return (
    <div className="max-w-[1180px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Network intelligence</h1>
        <p className="text-[13px] text-ink-soft mt-1">
          Transaction communities (Louvain) ranked by peak member risk. The graph is how controllers, collectors and off-ramps surface - link analysis reveals roles that account-level scores miss.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        {communities.map((c) => (
          <button key={c.cid} className="navpill shrink-0 !py-2 !gap-2"
            style={selected === c.cid ? { background: 'var(--color-brand-soft)', color: 'var(--color-brand)', fontWeight: 600, boxShadow: '0 0 0 1px rgba(44,217,255,0.22) inset, 0 0 16px rgba(44,217,255,0.10)' } : {}}
            onClick={() => setSelected(c.cid)}>
            <span className="font-semibold">#{c.cid}</span>
            <span className="num text-[11px]" style={{ color: c.maxScore >= 75 ? 'var(--color-risk-crit)' : c.maxScore >= 45 ? 'var(--color-risk-high)' : 'var(--color-ink-mute)' }}>peak {Math.round(c.maxScore)}</span>
            <span className="text-[10px] text-ink-mute">{c.members.length} acct - {c.complaints.length} cmp</span>
          </button>
        ))}
      </div>

      <div>
          {!sel || !layout ? (
            <div className="card p-10 text-center text-[13px] text-ink-mute">Select a network to inspect its graph and members.</div>
          ) : (
            <div className="card p-4">
              <SectionTitle>Network #{sel.cid} - {sel.members.length} accounts - combined inflow {inr(sel.flow)}</SectionTitle>
              <FlowGraph layout={layout} selNode={selNode} selEdge={selEdge}
                onSelectNode={(id) => { setSelNode(id); if (id) setSelEdge(null); }}
                onSelectEdge={(e) => { setSelEdge(e); if (e) setSelNode(null); }} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-ink-mute">
                {Object.entries(BAND_FILL).map(([b, c]) => (
                  <span key={b} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} /> {b}</span>
                ))}
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block border-2 border-[#FF4D5E] bg-white" /> Complaint-named</span>
              </div>

              {(nodeDetail || edgeDetail) && (
                <div className="mt-3 p-3 rounded-lg border border-line bg-[#0B1220]">
                  {nodeDetail && nodeDetail.sc && nodeDetail.f && (
                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <span className="text-[14px] font-semibold">{nodeDetail.nm}</span>
                          <span className="num text-[11px] text-ink-mute ml-2">{selNode}</span>
                        </div>
                        <ScoreBadge score={nodeDetail.sc.score} band={nodeDetail.sc.band} size="sm" />
                      </div>
                      <div className="text-[12px] text-ink-soft mt-1">
                        Observed pattern: {nodeDetail.sc.archetype} - inflow {inr(nodeDetail.f.inTotal)} - {nodeDetail.complaints.length} complaint{nodeDetail.complaints.length === 1 ? '' : 's'}
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <button className="btn" onClick={() => nav(`/accounts/${selNode}`)}>Open 360</button>
                        <button className="btn" onClick={() => nav(`/trails?account=${selNode}`)}>Trace funds</button>
                      </div>
                    </div>
                  )}
                  {edgeDetail && selEdge && (
                    <div>
                      <div className="text-[13px] font-semibold">
                        {nameOf(selEdge.from)} → {nameOf(selEdge.to)}
                      </div>
                      <div className="text-[12px] text-ink-soft mt-0.5">
                        {edgeDetail.count} transaction{edgeDetail.count === 1 ? '' : 's'} - total {inr(edgeDetail.total)}
                        {edgeDetail.txns[0] && ` - most recent ${fmtDate(edgeDetail.txns[0].ts)}`}
                      </div>
                      <div className="mt-2 space-y-1">
                        {edgeDetail.txns.slice(0, 5).map((t) => (
                          <div key={t.id} className="num text-[11px] text-ink-soft flex justify-between gap-3">
                            <span>{fmtDateTime(t.ts)}</span><span>{inrFull(t.amount)} - {t.channel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <table className="table-base mt-4">
                <thead><tr><th>Account</th><th>Pattern</th><th className="text-right">Inflow</th><th className="text-right">Score</th></tr></thead>
                <tbody>
                  {[...sel.members].sort((x, y) => (a.scores.get(y)?.score ?? 0) - (a.scores.get(x)?.score ?? 0)).slice(0, 12).map((m) => {
                    const s = a.scores.get(m)!;
                    const f = a.features.get(m)!;
                    const acc = a.world.accounts.find((x) => x.id === m);
                    const nm = a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? m;
                    return (
                      <tr key={m} className="rowlink" onClick={() => nav(`/accounts/${m}`)}>
                        <td><div className="text-[13px] font-medium">{nm}</div><div className="num text-[11px] text-ink-mute">{m}</div></td>
                        <td className="text-[12px] text-ink-soft">{s.archetype}</td>
                        <td className="num text-right text-[12px]">{inr(f.inTotal)}</td>
                        <td className="text-right"><ScoreBadge score={s.score} band={s.band} size="sm" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sel.complaints.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <div className="text-[12px] font-semibold text-ink-soft mb-1.5">Linked complaints</div>
                  {sel.complaints.map((c) => (
                    <div key={c.id} className="text-[12px] text-ink-soft mb-1"><span className="num">{c.ref}</span> - {c.category} - {inr(c.amountLost)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
