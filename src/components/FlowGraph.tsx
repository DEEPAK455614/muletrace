import React from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { Analysis } from '../engine';

export interface GN extends SimulationNodeDatum { id: string; score: number; band: string; inflow: number; name: string; complaint: boolean }
export interface GL extends SimulationLinkDatum<GN> { amount: number }
export interface GraphLayout { nodes: GN[]; links: GL[]; maxAmt: number }

export const BAND_FILL: Record<string, string> = {
  Critical: '#FF4D5E', High: '#FF7A45', Moderate: '#FFB020', Low: '#2FD48C', Minimal: '#5E7191',
};

export function buildCommunities(a: Analysis) {
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
}

export function buildLayout(a: Analysis, members: string[], width = 660, height = 480): GraphLayout {
  const memberSet = new Set(members);
  const nodes: GN[] = members.map((id) => {
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
  const links: GL[] = [...agg.entries()].map(([k, amount]) => {
    const [source, target] = k.split('->');
    return { source, target, amount };
  });
  const maxAmt = Math.max(...links.map((l) => l.amount), 1);
  const sim = forceSimulation(nodes)
    .force('link', forceLink<GN, GL>(links).id((d) => d.id).distance(70))
    .force('charge', forceManyBody().strength(-180))
    .force('collide', forceCollide(18))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX(width / 2).strength(0.06))
    .force('y', forceY(height / 2).strength(0.1))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();

  // Fit to view: normalize the simulated positions so the cluster spans the
  // canvas with margins - a 3-node chain should read as clearly as a 30-node web.
  const m = 56;
  const xs = nodes.map((n) => n.x ?? 0), ys = nodes.map((n) => n.y ?? 0);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const spanX = Math.max(x1 - x0, 1), spanY = Math.max(y1 - y0, 1);
  const scale = Math.min((width - 2 * m) / spanX, (height - 2 * m) / spanY, 2.4);
  const offX = m + ((width - 2 * m) - spanX * scale) / 2 - x0 * scale;
  const offY = m + ((height - 2 * m) - spanY * scale) / 2 - y0 * scale;
  for (const n of nodes) { n.x = (n.x ?? 0) * scale + offX; n.y = (n.y ?? 0) * scale + offY; }
  return { nodes, links, maxAmt };
}

export default function FlowGraph({ layout, selNode, selEdge, onSelectNode, onSelectEdge, width = 660, height = 480, labelScale = 1 }: {
  layout: GraphLayout;
  selNode?: string | null;
  selEdge?: { from: string; to: string } | null;
  onSelectNode?: (id: string | null) => void;
  onSelectEdge?: (e: { from: string; to: string } | null) => void;
  width?: number;
  height?: number;
  labelScale?: number;
}) {
  const interactive = Boolean(onSelectNode || onSelectEdge);
  const labelSize = (layout.nodes.length <= 8 ? 12.5 : layout.nodes.length <= 16 ? 11 : 9.5) * labelScale;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full mt-2 rounded-lg" style={{ background: '#0E1626', border: '1px solid var(--color-line)' }}>
      <defs>
        <marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#5E7191" />
        </marker>
      </defs>
      {layout.links.map((l, i) => {
        const sn = l.source as GN, t = l.target as GN;
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
              opacity={isSel ? 1 : 0.45} markerEnd="url(#edge-arrow)" className={interactive ? 'cursor-pointer' : ''}
              onClick={onSelectEdge ? () => onSelectEdge(isSel ? null : { from: sn.id, to: t.id }) : undefined} />
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
          <g key={n.id} className={interactive ? 'cursor-pointer' : ''}
            onClick={onSelectNode ? () => { onSelectNode(isSel ? null : n.id); onSelectEdge?.(null); } : undefined}>
            {isSel && <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke="#4F8CFF" strokeWidth={1.6} />}
            {n.complaint && (
              <circle cx={n.x} cy={n.y} r={r} fill="none" stroke="#FF4D5E" strokeWidth={1.2} className="flow-anim" style={{ pointerEvents: 'none' }}>
                <animate attributeName="r" values={`${r};${r + 10}`} dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={n.x} cy={n.y} r={r} fill={BAND_FILL[n.band] ?? '#5E7191'} opacity={0.88} stroke={n.complaint ? '#FF4D5E' : '#fff'} strokeWidth={n.complaint ? 2.5 : 1.5} />
            {(n.score >= 45 || n.complaint || isSel) && (
              <text x={n.x! + r + 3} y={n.y! + 3.5} fontSize={labelSize} fill="#8FA3C0" fontWeight={600}>{n.name.split(' ')[0]} - {Math.round(n.score)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
