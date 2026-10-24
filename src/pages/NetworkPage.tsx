import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inr, inrFull, fmtDate, fmtDateTime } from '../ui';

interface N extends SimulationNodeDatum { id: string; score: number; band: string; inflow: number; name: string; complaint: boolean }
interface L extends SimulationLinkDatum<N> { amount: number }

const BAND_FILL: Record<string, string> = {
  Critical: '#FF4D5E', High: '#FF7A45', Moderate: '#FFB020', Low: '#2FD48C', Minimal: '#5E7191',
};

export default function NetworkPage({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const communities = useMemo(() => {
    const byCommunity = new Map<number, string[]>();
    for (const [id, f] of a.features) byCommunity.set(f.communityId, [...(byCommunity.get(f.communityId) ?? []), id]);
    return [...byCommunity.entries()].map(([cid, members]) => {
      const scores = members.map((m) => a.scores.get(m)?.score ?? 0);
      const complaints = a.world.complaints.filter((c) => c.namedAccountIds.some((id) => members.includes(id)));
      const maxScore = Math.max(...scores, 0);
      const flagged = members.filter((m) => (a.scores.get(m)?.score ?? 0) >= 45);
      const flow = members.reduce((s, m) => s + (a.features.get(m)?.inTotal ?? 0), 0);
      return { cid, members, maxScore, flagged, complaints, flow, avg: scores.reduce((s, x) => s + x, 0) / members.length };
    }).filter((c) => c.maxScore >= 30 || c.complaints.length > 0)
      .sort((x, y) => y.maxScore - x.maxScore || y.flagged.length - x.flagged.length);
  }, [a]);

  const [selected, setSelected] = useState<number | null>(communities[0]?.cid ?? null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<{ from: string; to: string } | null>(null);
  const sel = communities.find((c) => c.cid === selected);

  const layout = useMemo(() => {
    if (!sel) return null;
    const memberSet = new Set(sel.members);
    const nodes: N[] = sel.members.map((id) => {
      const s = a.scores.get(id);
      const f = a.features.get(id);
      const acc = a.world.accounts.find((x) => x.id === id);
      return {
        id, score: s?.score ?? 0, band: s?.band ?? 'Minimal', inflow: f?.inTotal ?? 0,
        name: a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id,
        complaint: a.world.complaints.some((c) => c.namedAccountIds.includes(id)),
      };
    });
    const agg = new Map<string, number>();
    for (const t of a.world.txns) {
      if (memberSet.has(t.from) && memberSet.has(t.to)) {
        const k = `${t.from}->${t.to}`;
        agg.set(k, (agg.get(k) ?? 0) + t.amount);
      }
    }
    const links: L[] = [...agg.entries()].map(([k, amount]) => {
      const [source, target] = k.split('->');
      return { source, target, amount };
    });
    const maxAmt = Math.max(...links.map((l) => l.amount), 1);
    const sim = forceSimulation(nodes)
      .force('link', forceLink<N, L>(links).id((d) => d.id).distance(70))
      .force('charge', forceManyBody().strength(-180))
      .force('collide', forceCollide(18))
      .force('center', forceCenter(330, 240))
      .force('x', forceX(330).strength(0.06))
      .force('y', forceY(240).strength(0.1))
      .stop();
    for (let i = 0; i < 300; i++) sim.tick();
    return { nodes, links, maxAmt };
  }, [a, sel]);

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
              <svg viewBox="0 0 660 480" className="w-full mt-2 rounded-lg" style={{ background: '#0E1626', border: '1px solid var(--color-line)' }}>
                <defs>
                  <marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" fill="#5E7191" />
                  </marker>
                </defs>
                {layout.links.map((l, i) => {
                  const sn = l.source as N, t = l.target as N;
                  const dx = (t.x ?? 0) - (sn.x ?? 0), dy = (t.y ?? 0) - (sn.y ?? 0);
                  const len = Math.hypot(dx, dy) || 1;
                  const tr = 6 + Math.min(10, Math.sqrt(t.inflow) / 90);
                  const ex = (t.x ?? 0) - (dx / len) * (tr + 4), ey = (t.y ?? 0) - (dy / len) * (tr + 4);
                  const isSel = selEdge?.from === sn.id && selEdge?.to === t.id;
                  const pr = 1.4 + (l.amount / layout.maxAmt) * 2.2;
                  return (
                    <g key={i}>
                      <line x1={sn.x} y1={sn.y} x2={ex} y2={ey}
                        stroke={isSel ? '#4F8CFF' : '#44587A'} strokeWidth={(0.6 + (l.amount / layout.maxAmt) * 3.4) * (isSel ? 1.6 : 1)}
                        opacity={isSel ? 1 : 0.45} markerEnd="url(#edge-arrow)" className="cursor-pointer"
                        onClick={() => { setSelEdge(isSel ? null : { from: sn.id, to: t.id }); setSelNode(null); }} />
                      <circle r={pr} fill={isSel ? '#4F8CFF' : '#2CD9FF'} opacity={0.85} className="flow-anim" style={{ pointerEvents: 'none' }}>
                        <animateMotion dur={`${2.4 + (i % 5) * 0.6}s`} begin={`${(i % 7) * 0.35}s`} repeatCount="indefinite"
                          path={`M${sn.x ?? 0},${sn.y ?? 0} L${ex},${ey}`} />
                      </circle>
                    </g>
                  );
                })}
                {layout.nodes.map((n) => {
                  const r = 6 + Math.min(10, Math.sqrt(n.inflow) / 90);
                  const isSel = selNode === n.id;
                  return (
                    <g key={n.id} className="cursor-pointer" onClick={() => { setSelNode(isSel ? null : n.id); setSelEdge(null); }}>
                      {isSel && <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke="#4F8CFF" strokeWidth={1.6} />}
                      {n.complaint && (
                        <circle cx={n.x} cy={n.y} r={r} fill="none" stroke="#FF4D5E" strokeWidth={1.2} className="flow-anim" style={{ pointerEvents: 'none' }}>
                          <animate attributeName="r" values={`${r};${r + 10}`} dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle cx={n.x} cy={n.y} r={r} fill={BAND_FILL[n.band] ?? '#5E7191'} opacity={0.88} stroke={n.complaint ? '#FF4D5E' : '#fff'} strokeWidth={n.complaint ? 2.5 : 1.5} />
                      {(n.score >= 45 || n.complaint || isSel) && (
                        <text x={n.x! + r + 3} y={n.y! + 3.5} fontSize={9.5} fill="#8FA3C0" fontWeight={600}>{n.name.split(' ')[0]} - {Math.round(n.score)}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
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
