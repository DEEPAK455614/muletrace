import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inr } from '../ui';

interface N extends SimulationNodeDatum { id: string; score: number; band: string; inflow: number; name: string; complaint: boolean }
interface L extends SimulationLinkDatum<N> { amount: number }

const BAND_FILL: Record<string, string> = {
  Critical: '#D92D20', High: '#E0651F', Moderate: '#D99A1F', Low: '#1F9D6B', Minimal: '#8A93A3',
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

  return (
    <div className="max-w-[1180px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Network intelligence</h1>
        <p className="text-[13px] text-ink-soft mt-1">
          Transaction communities (Louvain) ranked by peak member risk. The graph is how controllers, collectors and off-ramps surface - link analysis reveals roles that account-level scores miss.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2 lg:max-h-[560px] lg:overflow-y-auto pr-1">
          {communities.map((c) => (
            <button key={c.cid} className="card w-full text-left p-3 cursor-pointer transition-shadow hover:shadow-md"
              style={selected === c.cid ? { borderColor: 'var(--color-brand)', boxShadow: '0 0 0 1px var(--color-brand)' } : {}}
              onClick={() => setSelected(c.cid)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[13px]">Network #{c.cid}</span>
                <span className="num text-[12px]" style={{ color: c.maxScore >= 75 ? 'var(--color-risk-crit)' : c.maxScore >= 45 ? 'var(--color-risk-high)' : 'var(--color-ink-mute)' }}>peak {Math.round(c.maxScore)}</span>
              </div>
              <div className="text-[11px] text-ink-mute mt-1">
                {c.members.length} accounts - {c.flagged.length} flagged - {c.complaints.length} complaint{c.complaints.length === 1 ? '' : 's'} - {inr(c.flow)} inflow
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {!sel || !layout ? (
            <div className="card p-10 text-center text-[13px] text-ink-mute">Select a network to inspect its graph and members.</div>
          ) : (
            <div className="card p-4">
              <SectionTitle>Network #{sel.cid} - {sel.members.length} accounts - combined inflow {inr(sel.flow)}</SectionTitle>
              <svg viewBox="0 0 660 480" className="w-full mt-2 rounded-lg" style={{ background: '#F5F4F0', border: '1px solid var(--color-line)' }}>
                {layout.links.map((l, i) => {
                  const s = l.source as N, t = l.target as N;
                  return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#B9B4A8" strokeWidth={0.6 + (l.amount / layout.maxAmt) * 3.4} opacity={0.6} />;
                })}
                {layout.nodes.map((n) => {
                  const r = 6 + Math.min(10, Math.sqrt(n.inflow) / 90);
                  return (
                    <g key={n.id} className="cursor-pointer" onClick={() => nav(`/accounts/${n.id}`)}>
                      <circle cx={n.x} cy={n.y} r={r} fill={BAND_FILL[n.band] ?? '#8A93A3'} opacity={0.88} stroke={n.complaint ? '#D92D20' : '#fff'} strokeWidth={n.complaint ? 2.5 : 1.5} />
                      {(n.score >= 45 || n.complaint) && (
                        <text x={n.x! + r + 3} y={n.y! + 3.5} fontSize={9.5} fill="#3A4152" fontWeight={600}>{n.name.split(' ')[0]} - {Math.round(n.score)}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-ink-mute">
                {Object.entries(BAND_FILL).map(([b, c]) => (
                  <span key={b} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} /> {b}</span>
                ))}
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block border-2 border-[#D92D20] bg-white" /> Complaint-named</span>
              </div>

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
    </div>
  );
}
