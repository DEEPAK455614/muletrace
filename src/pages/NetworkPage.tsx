import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, SectionTitle, inr, inrFull, fmtDate, fmtDateTime, Breadcrumbs, FactorBars } from '../ui';
import FlowGraph, { buildCommunities, buildLayout, GraphLegend } from '../components/FlowGraph';
import { loadTriage, TRIAGE_COLORS, TRIAGE_LABELS } from '../state/triage';
import { ArrowRight, ExternalLink, X } from 'lucide-react';

export default function NetworkPage({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const communities = useMemo(() => buildCommunities(a), [a]);
  const [selected, setSelected] = useState<number | null>(communities[0]?.cid ?? null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<{ from: string; to: string } | null>(null);
  const sel = communities.find((c) => c.cid === selected);
  const layout = useMemo(() => (sel ? buildLayout(a, sel.members, 700, 400) : null), [a, sel]);
  const triage = loadTriage();

  const nameOf = (id: string) => {
    if (id === 'ATM') return 'ATM (cash out)';
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };
  const nodeDetail = useMemo(() => {
    if (!selNode) return null;
    const sc = a.scores.get(selNode);
    const f = a.features.get(selNode);
    const acc = a.world.accounts.find((x) => x.id === selNode);
    const complaints = a.world.complaints.filter((c) => c.namedAccountIds.includes(selNode));
    return { sc, f, acc, nm: nameOf(selNode), complaints };
  }, [a, selNode]);
  const edgeDetail = useMemo(() => {
    if (!selEdge || !sel) return null;
    const txns = a.world.txns.filter((t) => t.from === selEdge.from && t.to === selEdge.to).sort((x, y) => y.ts - x.ts);
    return { txns: txns.slice(0, 8), count: txns.length, total: txns.reduce((sum, t) => sum + t.amount, 0) };
  }, [a, selEdge, sel]);

  const clearSelection = () => { setSelNode(null); setSelEdge(null); };
  const selectMember = (id: string) => { setSelNode(id); setSelEdge(null); };

  return (
    <div className="max-w-[1260px] mx-auto">
      <Breadcrumbs items={[{ label: 'Investigation' }, { label: 'Network intelligence' }]} />
      <div className="flex items-start justify-between gap-6 border-b border-line pb-5 mb-5">
        <div>
          <div className="flex items-end gap-3">
            <h1 className="text-[25px] leading-8 font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Network intelligence</h1>
            <span className="num text-[12px] text-ink-mute mb-1">Community register · {communities.length} detected</span>
          </div>
          <p className="mt-2 max-w-[720px] text-[13px] text-ink-soft">Inspect transaction communities, then pivot into account evidence, complaint records, and time-respecting trails.</p>
        </div>
        <div className="hidden lg:block text-right pt-1">
          <div className="text-[11px] text-ink-mute">Ranking basis</div>
          <div className="mt-1 text-[13px]">Peak member score</div>
          <div className="mt-2 text-[11px] text-ink-mute">Membership does not establish a person’s role.</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_360px] gap-4 items-start">
        <section className="border border-line bg-surface rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between"><div className="text-[13px] font-semibold">Communities</div><span className="num text-[11px] text-ink-mute">{communities.length}</span></div>
          <div className="p-2 space-y-1">
            {communities.slice(0, 10).map((c) => (
              <button key={c.cid} className={`w-full text-left px-2.5 py-2.5 rounded-sm cursor-pointer transition-colors ${selected === c.cid ? 'bg-brand-soft border-l-2 border-brand' : 'hover:bg-raised'}`} onClick={() => { setSelected(c.cid); clearSelection(); }}>
                <div className="flex justify-between gap-2"><span className="num text-[12px]">#{c.cid}</span><span className="num text-[12px]" style={{ color: c.maxScore >= 75 ? 'var(--color-risk-crit)' : c.maxScore >= 45 ? 'var(--color-risk-high)' : 'var(--color-risk-mod)' }}>{Math.round(c.maxScore)}</span></div>
                <div className="mt-1 flex gap-3 text-[11px] text-ink-soft"><span>{c.members.length} accounts</span><span className="text-risk-mod">{c.complaints.length} named</span></div>
              </button>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-line text-[11px] text-ink-mute">Sorted by highest member score</div>
        </section>

        <section className="min-w-0 border border-line bg-surface rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
            <div><div className="text-[13px] font-semibold">{sel ? `Community #${sel.cid}` : 'No community selected'}</div>{sel && <div className="num text-[11px] text-ink-soft mt-1">{sel.members.length} accounts · {inr(sel.flow)} combined inflow · {sel.complaints.length} named in complaints</div>}</div>
            <div className="hidden xl:block text-right text-[11px] text-ink-mute">Observed transaction links<br /><span className="text-ink-soft">Layout is spatial, not chronological.</span></div>
          </div>
          <div className="px-3 py-2 graph-panel"><GraphLegend />{sel && layout ? <FlowGraph layout={layout} selNode={selNode} selEdge={selEdge} onSelectNode={(id) => { setSelNode(id); setSelEdge(null); }} onSelectEdge={(edge) => { setSelEdge(edge); setSelNode(null); }} width={700} height={400} /> : <div className="h-[400px] flex items-center justify-center text-sm text-ink-mute">Select a community to inspect its observed links.</div>}</div>
          <div className="px-4 py-3 border-t border-line text-[11px] text-ink-mute flex items-center justify-between gap-3"><span>Solid paths show aggregated observed transactions. Amount labels use the active dataset.</span><span className="text-ink-soft">Select a node, link, or member row.</span></div>
        </section>

        <aside className="border border-line bg-surface rounded-md overflow-hidden min-h-[400px]">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between"><div className="text-[13px] font-semibold">Selected evidence</div>{(nodeDetail || edgeDetail) && <button className="text-ink-mute hover:text-ink cursor-pointer" onClick={clearSelection} aria-label="Clear selected evidence"><X size={15} /></button>}</div>
          {!nodeDetail && !edgeDetail && <div className="px-4 py-5 text-[13px] text-ink-mute">Select a community member or observed transaction link to inspect supporting records without leaving this view.</div>}
          {nodeDetail?.sc && nodeDetail.f && <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-3"><div><div className="text-[19px] leading-6 font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{nodeDetail.nm}</div><div className="num text-[11px] text-ink-soft mt-1">{selNode} · {nodeDetail.acc?.bank} · {nodeDetail.acc?.type}</div></div><div className="text-right"><div className="num text-[22px] leading-6" style={{ color: `var(--color-risk-${nodeDetail.sc.band === 'Critical' ? 'crit' : nodeDetail.sc.band === 'High' ? 'high' : nodeDetail.sc.band === 'Moderate' ? 'mod' : 'low'})` }}>{nodeDetail.sc.score}</div><div className="text-[11px] text-ink-mute mt-1">{nodeDetail.sc.band}</div></div></div>
            <div className="mt-4 border-t border-line pt-3"><div className="text-[10px] uppercase tracking-wider text-ink-mute">Observed pattern</div><div className="mt-1 text-[13px]">{nodeDetail.sc.archetype}</div></div>
            <div className="mt-4"><div className="text-[10px] uppercase tracking-wider text-ink-mute mb-2">Strongest factors</div><FactorBars factors={nodeDetail.sc.factors.slice(0, 3)} /></div>
            <div className="mt-4 border-t border-line pt-3"><div className="text-[10px] uppercase tracking-wider text-ink-mute">Complaint references</div>{nodeDetail.complaints.length ? nodeDetail.complaints.slice(0, 3).map((c) => <div key={c.id} className="mt-2"><div className="num text-[12px] text-brand">{c.ref}</div><div className="text-[11px] text-ink-soft">Reported loss {inrFull(c.amountLost)} · {c.city}</div></div>) : <div className="mt-2 text-[12px] text-ink-mute">Not named in available complaints.</div>}</div>
            <div className="mt-5 flex gap-2"><button className="btn btn-primary flex-1" onClick={() => nav(`/accounts/${selNode}`)}>Open account <ExternalLink size={13} /></button><button className="btn" onClick={() => nav(`/trails?account=${selNode}`)}>Trace funds</button></div>
            <div className="mt-3 text-[11px] leading-4 text-ink-mute">Scores rank suspicion for human review. They are not findings of guilt.</div>
          </div>}
          {edgeDetail && selEdge && <div className="px-4 py-4"><div className="text-[15px] font-semibold">{nameOf(selEdge.from)} <ArrowRight size={14} className="inline mx-1 text-brand" /> {nameOf(selEdge.to)}</div><div className="num text-[11px] text-ink-soft mt-1">{selEdge.from} → {selEdge.to}</div><div className="mt-4 border-t border-line pt-3 text-[12px] text-ink-soft">{edgeDetail.count} observed transaction{edgeDetail.count === 1 ? '' : 's'} · total <span className="num text-ink">{inr(edgeDetail.total)}</span>{edgeDetail.txns[0] && ` · most recent ${fmtDate(edgeDetail.txns[0].ts)}`}</div><div className="mt-3 space-y-1.5">{edgeDetail.txns.slice(0, 5).map((t) => <div key={t.id} className="num text-[11px] text-ink-soft flex justify-between gap-3 py-1 border-b border-line-soft"><span>{fmtDateTime(t.ts)}</span><span>{inrFull(t.amount)} · {t.channel}</span></div>)}</div><div className="mt-3 text-[11px] text-ink-mute">Showing {Math.min(edgeDetail.txns.length, 5)} of {edgeDetail.count} records.</div></div>}
        </aside>
      </div>

      {sel && <section className="mt-4 border border-line bg-surface rounded-md overflow-hidden"><div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3"><div><div className="text-[13px] font-semibold">Members in community #{sel.cid}</div><div className="text-[11px] text-ink-mute mt-1">Select a row to update the evidence inspector. Open Account 360 with the explicit account action.</div></div><div className="flex gap-2"><button className="btn !min-h-0 !py-1.5 !px-3 text-[11px]" onClick={() => nav('/alerts')}>Review alert queue</button><button className="btn !min-h-0 !py-1.5 !px-3 text-[11px]" onClick={() => nav('/audit')}>View audit trail</button></div></div><div className="table-scroll"><table className="table-base min-w-[760px]"><thead><tr><th>Account</th><th>Complaint relation</th><th>Strongest observed factor</th><th>Triage</th><th className="text-right">Inflow</th><th className="text-right">Score</th><th /></tr></thead><tbody>{[...sel.members].sort((x, y) => (a.scores.get(y)?.score ?? 0) - (a.scores.get(x)?.score ?? 0)).slice(0, 12).map((id) => { const score = a.scores.get(id); const f = a.features.get(id); const acc = a.world.accounts.find((x) => x.id === id); const complaints = a.world.complaints.filter((c) => c.namedAccountIds.includes(id)); const status = triage[id]?.status ?? 'new'; return <tr key={id} className={`rowlink ${selNode === id ? 'bg-brand-soft' : ''}`} tabIndex={0} onClick={() => selectMember(id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectMember(id); } }}><td><div className="font-medium text-[13px]">{nameOf(id)}</div><div className="num text-[11px] text-ink-mute">{id} · {acc?.bank}</div></td><td className="text-[12px]" style={{ color: complaints.length ? 'var(--color-risk-mod)' : 'var(--color-ink-soft)' }}>{complaints.length ? `Named · ${complaints.length} complaint${complaints.length === 1 ? '' : 's'}` : 'Not named'}</td><td className="text-[12px] text-ink-soft">{score?.factors[0]?.label ?? 'No scored factor'}</td><td><span className="chip" style={{ color: TRIAGE_COLORS[status], background: `${TRIAGE_COLORS[status]}18`, borderColor: `${TRIAGE_COLORS[status]}45` }}>{TRIAGE_LABELS[status]}</span></td><td className="num text-right text-[12px]">{inr(f?.inTotal ?? 0)}</td><td className="text-right">{score && <ScoreBadge score={score.score} band={score.band} size="sm" />}</td><td className="text-right"><button className="text-[11px] text-brand hover:underline cursor-pointer" onClick={(event) => { event.stopPropagation(); nav(`/accounts/${id}`); }}>Open account</button></td></tr>; })}</tbody></table></div><div className="px-4 py-3 border-t border-line text-[11px] text-ink-mute">Showing {Math.min(sel.members.length, 12)} of {sel.members.length} members · derived from the active dataset.</div></section>}
    </div>
  );
}
