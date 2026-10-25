import React from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceCenter, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { Analysis } from '../engine';
import { inr } from '../ui';

export interface GN extends SimulationNodeDatum { id: string; score: number; band: string; inflow: number; name: string; complaint: boolean }
export interface GL extends SimulationLinkDatum<GN> { amount: number }
export interface GraphLayout { nodes: GN[]; links: GL[]; maxAmt: number }

export const BAND_FILL: Record<string, string> = {
  Critical: 'var(--color-risk-crit)',
  High: 'var(--color-risk-high)',
  Moderate: 'var(--color-risk-mod)',
  Low: 'var(--color-risk-low)',
  Minimal: 'var(--color-ink-mute)',
};

export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-mute py-2">
      <span className="font-semibold uppercase tracking-wider text-ink-soft text-[10px]">Observed transaction links</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-crit inline-block" /> Critical (≥75)</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-high inline-block" /> High (45–74)</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-mod inline-block" /> Moderate (30–44)</span>
      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-low inline-block" /> Low (&lt;30)</span>
      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-risk-crit inline-block" /> Complaint-named</span>
      <span className="text-ink-mute">Layout is spatial, not chronological.</span>
    </div>
  );
}

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
    .force('link', forceLink<GN, GL>(links).id((d) => d.id).distance(76))
    .force('charge', forceManyBody().strength(-190))
    .force('collide', forceCollide(20))
    .force('center', forceCenter(width / 2, height / 2))
    .force('x', forceX(width / 2).strength(0.06))
    .force('y', forceY(height / 2).strength(0.1))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();

  const margin = 54;
  const xs = nodes.map((n) => n.x ?? 0), ys = nodes.map((n) => n.y ?? 0);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const spanX = Math.max(x1 - x0, 1), spanY = Math.max(y1 - y0, 1);
  const scale = Math.min((width - 2 * margin) / spanX, (height - 2 * margin) / spanY, 2.4);
  const offX = margin + ((width - 2 * margin) - spanX * scale) / 2 - x0 * scale;
  const offY = margin + ((height - 2 * margin) - spanY * scale) / 2 - y0 * scale;
  for (const n of nodes) { n.x = (n.x ?? 0) * scale + offX; n.y = (n.y ?? 0) * scale + offY; }
  return { nodes, links, maxAmt };
}

function linkKey(link: GL) {
  const source = typeof link.source === 'string' ? link.source : (link.source as GN).id;
  const target = typeof link.target === 'string' ? link.target : (link.target as GN).id;
  return `${source}->${target}`;
}

function edgePath(source: GN, target: GN, curve: number) {
  const sx = source.x ?? 0, sy = source.y ?? 0, tx = target.x ?? 0, ty = target.y ?? 0;
  const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = (sx + tx) / 2 + nx * curve, cy = (sy + ty) / 2 + ny * curve;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

export default function FlowGraph({ layout, selNode, selEdge, onSelectNode, onSelectEdge, width = 660, height = 400 }: {
  layout: GraphLayout;
  selNode?: string | null;
  selEdge?: { from: string; to: string } | null;
  onSelectNode?: (id: string | null) => void;
  onSelectEdge?: (e: { from: string; to: string } | null) => void;
  width?: number;
  height?: number;
}) {
  const markerId = `flow-arrow-${React.useId().replace(/:/g, '')}`;
  const interactive = Boolean(onSelectNode || onSelectEdge);
  const labelSize = layout.nodes.length <= 8 ? 11.5 : layout.nodes.length <= 16 ? 10.5 : 9.5;
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const reverseKeys = new Set(layout.links.map((link) => {
    const source = typeof link.source === 'string' ? link.source : (link.source as GN).id;
    const target = typeof link.target === 'string' ? link.target : (link.target as GN).id;
    return `${target}->${source}`;
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full graph-panel" role="img" aria-label="Observed directed transaction network">
      <defs>
        <marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--color-ink-mute)" />
        </marker>
        <marker id={`${markerId}-selected`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--color-brand)" />
        </marker>
      </defs>
      <text x="16" y="20" fill="var(--color-ink-mute)" fontFamily="var(--font-mono)" fontSize="10">OBSERVED TRANSACTION LINKS · NOT CHRONOLOGICAL</text>
      {layout.links.map((link, index) => {
        const source = nodeById.get(typeof link.source === 'string' ? link.source : (link.source as GN).id);
        const target = nodeById.get(typeof link.target === 'string' ? link.target : (link.target as GN).id);
        if (!source || !target) return null;
        const from = source.id, to = target.id;
        const isSelected = selEdge?.from === from && selEdge?.to === to;
        const hasReverse = reverseKeys.has(`${from}->${to}`);
        const curve = hasReverse ? (index % 2 === 0 ? 13 : -13) : ((index % 3) - 1) * 5;
        const d = edgePath(source, target, curve);
        const amountRatio = link.amount / layout.maxAmt;
        const strokeWidth = 1.2 + amountRatio * 2.4;
        const labelX = ((source.x ?? 0) + (target.x ?? 0)) / 2;
        const labelY = ((source.y ?? 0) + (target.y ?? 0)) / 2 + (curve < 0 ? -7 : 12);
        return (
          <g key={linkKey(link)} className={interactive ? 'graph-edge' : undefined}>
            <path d={d} className="graph-edge-hit" fill="none" onClick={onSelectEdge ? () => onSelectEdge(isSelected ? null : { from, to }) : undefined} />
            <path d={d} fill="none" stroke={isSelected ? 'var(--color-brand)' : 'var(--color-ink-mute)'} strokeWidth={isSelected ? strokeWidth + 1.3 : strokeWidth} opacity={isSelected ? 1 : 0.72} markerEnd={`url(#${isSelected ? `${markerId}-selected` : markerId})`} onClick={onSelectEdge ? () => onSelectEdge(isSelected ? null : { from, to }) : undefined} />
            {(layout.links.length <= 14 || isSelected) && <text x={labelX} y={labelY} textAnchor="middle" fill={isSelected ? 'var(--color-ink)' : 'var(--color-ink-soft)'} fontFamily="var(--font-mono)" fontSize="9">{inr(link.amount)}</text>}
          </g>
        );
      })}
      {layout.nodes.map((node) => {
        const radius = 7 + Math.min(9, Math.sqrt(node.inflow) / 95);
        const selected = selNode === node.id;
        const nodeColor = BAND_FILL[node.band] ?? BAND_FILL.Minimal;
        return (
          <g key={node.id} className={interactive ? 'graph-node' : undefined} tabIndex={interactive ? 0 : undefined} role={interactive ? 'button' : undefined} aria-label={`${node.name} ${node.id}, score ${Math.round(node.score)}, ${node.band}${node.complaint ? ', complaint-named' : ''}`} onClick={onSelectNode ? () => { onSelectNode(selected ? null : node.id); onSelectEdge?.(null); } : undefined} onKeyDown={onSelectNode ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectNode(selected ? null : node.id); onSelectEdge?.(null); } } : undefined}>
            <title>{`${node.name} (${node.id}) · score ${Math.round(node.score)} · ${node.band}${node.complaint ? ' · complaint-named' : ''}`}</title>
            {selected && <circle cx={node.x} cy={node.y} r={radius + 8} fill="none" stroke="var(--color-brand)" strokeWidth="2" />}
            {node.complaint && <circle cx={node.x} cy={node.y} r={radius + 3} fill="none" stroke="var(--color-risk-crit)" strokeWidth="1.5" />}
            <circle cx={node.x} cy={node.y} r={radius} fill="var(--color-raised)" stroke={nodeColor} strokeWidth={selected ? 2.5 : 2} />
            <circle cx={node.x} cy={node.y} r={Math.max(3, radius - 4)} fill={nodeColor} opacity="0.84" />
            {(node.score >= 45 || node.complaint || selected) && <text x={(node.x ?? 0) + radius + 5} y={(node.y ?? 0) - 2} fill="var(--color-ink)" fontSize={labelSize} fontWeight="600">{node.name.split(' ')[0]}</text>}
            {(node.score >= 45 || node.complaint || selected) && <text x={(node.x ?? 0) + radius + 5} y={(node.y ?? 0) + 11} fill="var(--color-ink-mute)" fontFamily="var(--font-mono)" fontSize="9">{node.id}</text>}
          </g>
        );
      })}
    </svg>
  );
}
