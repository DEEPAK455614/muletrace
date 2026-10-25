import React, { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { traceTrail, traceComplaint, type TrailResult, type TrailHop } from '../engine/trails';
import { fmtDateTime, inrFull } from '../ui';
import { ArrowLeft, ArrowRight, ChevronDown, CircleHelp, GitBranch, Signpost } from 'lucide-react';

type SourceMode = 'account' | 'complaint';
type TraceStatus = 'idle' | 'ready' | 'stale' | 'not-found' | 'no-results';
type Direction = 'forward' | 'backward';
type WindowDays = 7 | 14 | 21 | 30 | 90 | 365;
interface SubmittedTrace { sourceMode: SourceMode; sourceValue: string; direction: Direction; windowDays: WindowDays; results: TrailResult[] }

function mergeResults(results: TrailResult[] | null) {
  if (!results || results.length === 0) return null;
  const seen = new Set<string>();
  const hops = results.flatMap((result) => result.hops).filter((hop) => {
    if (seen.has(hop.txnId)) return false;
    seen.add(hop.txnId);
    return true;
  }).sort((a, b) => a.ts - b.ts);
  const endpoints = new Map<string, { id: string; kind: TrailResult['endpoints'][number]['kind']; amount: number }>();
  results.flatMap((result) => result.endpoints).forEach((endpoint) => {
    const key = `${endpoint.id}:${endpoint.kind}`;
    const current = endpoints.get(key);
    endpoints.set(key, { ...endpoint, amount: (current?.amount ?? 0) + endpoint.amount });
  });
  return {
    hops,
    endpoints: [...endpoints.values()],
    totalTraced: hops.reduce((sum, hop) => sum + hop.amount, 0),
    exitValue: [...endpoints.values()].reduce((sum, endpoint) => sum + endpoint.amount, 0),
    maxDepth: Math.max(...results.map((result) => result.maxDepth), 0),
  };
}

function scoreColor(score: number | undefined) {
  if (score === undefined) return 'var(--color-ink-mute)';
  if (score >= 75) return 'var(--color-risk-crit)';
  if (score >= 45) return 'var(--color-risk-high)';
  if (score >= 30) return 'var(--color-risk-mod)';
  return 'var(--color-risk-low)';
}

function TracePath({ hops, selectedTxnId, scores, nameOf, onSelect }: { hops: TrailHop[]; selectedTxnId?: string; scores: Analysis['scores']; nameOf: (id: string) => string; onSelect: (hop: TrailHop) => void }) {
  const width = 760;
  const height = 300;
  const orderedIds: string[] = [];
  hops.forEach((hop) => { if (!orderedIds.includes(hop.from)) orderedIds.push(hop.from); if (!orderedIds.includes(hop.to)) orderedIds.push(hop.to); });
  const positions = new Map<string, { x: number; y: number }>();
  orderedIds.forEach((id, index) => positions.set(id, { x: 58 + (index % 6) * 126, y: index % 2 === 0 ? 150 : 88 }));
  const markerId = React.useId().replace(/:/g, '');
  const nodeRadius = () => 15;
  const displayName = (id: string) => id === 'ATM' ? 'ATM' : nameOf(id).split(' ')[0];
  const edgePath = (from: { x: number; y: number }, to: { x: number; y: number }, loop: boolean) => {
    if (loop) return `M ${from.x} ${from.y} C ${from.x + 80} ${from.y + 110}, ${to.x - 80} ${to.y + 110}, ${to.x} ${to.y}`;
    const midX = (from.x + to.x) / 2;
    const curve = from.y === to.y ? 0 : (to.y > from.y ? 16 : -16);
    return `M ${from.x} ${from.y} Q ${midX} ${from.y + curve} ${to.x} ${to.y}`;
  };

  return (
    <div className="graph-panel relative overflow-x-auto p-3">
      <div className="absolute left-4 top-4 z-10 num text-[10px] text-ink-mute">OBSERVED TRANSACTIONS · NOT PREDICTION</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] w-full mt-5" role="img" aria-label="Observed directed transaction path">
        <defs>
          <marker id={`${markerId}-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--color-ink-mute)" /></marker>
          <marker id={`${markerId}-selected`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--color-brand)" /></marker>
        </defs>
        {hops.map((hop) => {
          const from = positions.get(hop.from), to = positions.get(hop.to);
          if (!from || !to) return null;
          const selected = hop.txnId === selectedTxnId;
          const loop = hop.from === hop.to || (to.x < from.x - 20);
          return <g key={hop.txnId} className="cursor-pointer" onClick={() => onSelect(hop)}><path d={edgePath(from, to, loop)} fill="none" stroke={selected ? 'var(--color-brand)' : scoreColor(scores.get(hop.to)?.score)} strokeWidth={selected ? 3.4 : 2} opacity={selected ? 1 : 0.72} markerEnd={`url(#${selected ? `${markerId}-selected` : `${markerId}-arrow`})`} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - (loop ? 16 : 8)} textAnchor="middle" fill={selected ? 'var(--color-ink)' : 'var(--color-ink-soft)'} fontFamily="var(--font-mono)" fontSize="9">{inrFull(hop.amount)}</text></g>;
        })}
        {[...positions.entries()].map(([id, point]) => {
          const score = scores.get(id)?.score;
          const selected = hops.some((hop) => hop.txnId === selectedTxnId && (hop.from === id || hop.to === id));
          const color = id === 'ATM' ? 'var(--color-risk-low)' : scoreColor(score);
          return <g key={id} role="img" aria-label={`${id}${score === undefined ? '' : ` score ${score}`}`}><circle cx={point.x} cy={point.y} r={selected ? nodeRadius() + 9 : nodeRadius()} fill="none" stroke={selected ? 'var(--color-brand)' : 'transparent'} strokeWidth="2" /><circle cx={point.x} cy={point.y} r={nodeRadius()} fill="var(--color-raised)" stroke={color} strokeWidth="2" /><circle cx={point.x} cy={point.y} r="5" fill={color} opacity="0.8" /><text x={point.x} y={point.y + 34} textAnchor="middle" fill="var(--color-ink)" fontFamily="var(--font-mono)" fontSize="10">{id}</text><text x={point.x} y={point.y + 48} textAnchor="middle" fill={id === 'ATM' ? 'var(--color-risk-low)' : 'var(--color-ink-mute)'} fontSize="9">{displayName(id)}</text></g>;
        })}
      </svg>
      <div className="flex flex-wrap justify-between gap-2 pt-2 text-[11px] text-ink-mute"><span>Arrow direction = observed payment direction</span><span>Click a path or row to inspect the transaction.</span></div>
    </div>
  );
}

export default function Trails({ a }: { a: Analysis }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const initialAccount = params.get('account') ?? '';
  const initialComplaint = params.get('complaint') ?? '';
  const [sourceMode, setSourceMode] = useState<SourceMode>(initialComplaint ? 'complaint' : 'account');
  const [accountDraft, setAccountDraft] = useState(initialAccount);
  const [complaintDraft, setComplaintDraft] = useState(initialComplaint);
  const [direction, setDirection] = useState<Direction>('forward');
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [submitted, setSubmitted] = useState<SubmittedTrace | null>(() => {
    if (initialComplaint) {
      const complaint = a.world.complaints.find((item) => item.ref.toLowerCase() === initialComplaint.toLowerCase());
      return complaint ? { sourceMode: 'complaint', sourceValue: complaint.ref, direction: 'forward', windowDays: 21, results: traceComplaint(a.world, complaint.id) } : null;
    }
    if (initialAccount && a.world.accounts.some((item) => item.id === initialAccount)) return { sourceMode: 'account', sourceValue: initialAccount, direction: 'forward', windowDays: 30, results: [traceTrail(a.world, initialAccount, 'forward', { windowDays: 30 })] };
    return null;
  });
  const [selectedTxnId, setSelectedTxnId] = useState<string | undefined>();

  const dirty = !submitted || submitted.sourceMode !== sourceMode || submitted.sourceValue !== (sourceMode === 'account' ? accountDraft.trim() : complaintDraft.trim()) || submitted.direction !== direction || (sourceMode === 'account' && submitted.windowDays !== windowDays);
  const merged = useMemo(() => mergeResults(submitted?.results ?? null), [submitted]);
  const selectedTxn = merged?.hops.find((hop) => hop.txnId === selectedTxnId) ?? merged?.hops[0];
  const selectedIndex = selectedTxn ? (merged?.hops.findIndex((hop) => hop.txnId === selectedTxn.txnId) ?? -1) : -1;
  const selectedAccountComplaint = selectedTxn ? a.world.complaints.find((c) => c.namedAccountIds.includes(selectedTxn.to) || c.namedAccountIds.includes(selectedTxn.from)) : undefined;

  const networkContext = useMemo(() => {
    const seedIds = submitted?.sourceMode === 'account'
      ? [submitted.sourceValue]
      : (submitted?.results.flatMap((result) => result.nodes) ?? []);
    const communityId = seedIds.map((id) => a.features.get(id)?.communityId).find((id): id is number => id !== undefined);
    if (communityId === undefined) return null;
    const members = [...a.features.entries()].filter(([, features]) => features.communityId === communityId).map(([id]) => id);
    const memberSet = new Set(members);
    const complaints = a.world.complaints.filter((complaint) => complaint.namedAccountIds.some((id) => memberSet.has(id))).length;
    return { communityId, accountCount: members.length, complaintCount: complaints };
  }, [a, submitted]);

  const nameOf = (id: string) => {
    if (id === 'ATM') return 'ATM (cash out)';
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };
  const kindLabel = (kind: TrailResult['endpoints'][number]['kind']) => kind === 'cash-out' ? 'Cash withdrawal' : kind === 'terminal-account' ? 'Terminal account in the available trace' : 'Beyond window';

  const runTrace = () => {
    if (sourceMode === 'account') {
      const value = accountDraft.trim();
      if (!value || !a.world.accounts.some((item) => item.id === value)) { setSubmitted(null); return; }
      setSubmitted({ sourceMode, sourceValue: value, direction, windowDays, results: [traceTrail(a.world, value, direction, { windowDays })] });
    } else {
      const value = complaintDraft.trim();
      const complaint = a.world.complaints.find((item) => item.ref.toLowerCase() === value.toLowerCase());
      if (!complaint) { setSubmitted(null); return; }
      setSubmitted({ sourceMode, sourceValue: complaint.ref, direction: 'forward', windowDays: 21, results: traceComplaint(a.world, complaint.id) });
    }
    setSelectedTxnId(undefined);
  };
  const status: TraceStatus = dirty ? (submitted ? 'stale' : 'idle') : !submitted ? 'not-found' : merged?.hops.length ? 'ready' : 'no-results';
  const statusMessage = status === 'stale' ? 'Parameters changed; run trace to update' : status === 'not-found' ? 'Enter a known account ID or complaint reference' : status === 'no-results' ? 'No qualifying transactions within this window.' : null;
  const datasetLabel = a.world.seed === 'uploaded' ? 'Dataset: uploaded data' : 'Dataset: SYN-2026-10';

  return (
    <div className="max-w-[1240px] mx-auto">
      <div className="-mx-4 md:-mx-8 -mt-5 md:-mt-7 mb-7 h-16 border-b border-line bg-paper flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 text-[12px] text-ink-mute"><span>Network intelligence</span><span className="text-line">/</span><span className="text-ink">Money trail reconstruction</span></div>
        <div className="flex items-center gap-4 text-[11px] text-ink-mute"><span className="num hidden sm:inline">{datasetLabel}</span><span className="w-px h-4 bg-line hidden sm:block" /><button className="text-ink-soft flex items-center gap-1.5 cursor-pointer" onClick={() => nav('/methodology')}><CircleHelp size={14} /> Methodology</button></div>
      </div>

      <div className="flex items-start justify-between gap-8 mb-6">
        <div><div className="flex items-center gap-3 mb-2"><h1 className="text-[25px] leading-tight font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Chronological reconstruction</h1>{networkContext && <span className="num text-[11px] text-brand border border-brand/40 bg-brand-soft px-2 py-1 rounded-sm">NETWORK #{networkContext.communityId}</span>}</div><p className="text-[13px] text-ink-soft max-w-[720px]">Trace observed transactions from <span className="num text-ink">{submitted?.sourceValue ?? 'the selected source'}</span>{networkContext ? ` through the selected community. ` : ' . '}This reconstruction follows observed transaction order and allocation assumptions.</p></div>
        <div className="hidden md:block text-right shrink-0"><div className="text-[11px] text-ink-mute">Context</div><div className="num text-[12px] text-ink-soft mt-1">{networkContext ? `Network #${networkContext.communityId} · ${networkContext.accountCount} accounts · ${networkContext.complaintCount} complaints` : 'No trace submitted'}</div><button className="text-[12px] text-brand inline-flex items-center gap-1 mt-2 cursor-pointer" onClick={() => nav('/network')}><ArrowLeft size={13} /> Return to network</button></div>
      </div>

      <section className="border-y border-line bg-surface px-4 py-4 mb-6">
        <div className="grid xl:grid-cols-[176px_190px_220px_138px_auto_1fr] gap-3 items-end">
          <div><label className="block text-[11px] text-ink-mute mb-1.5">Source mode</label><div className="flex border border-line rounded-sm overflow-hidden h-9"><button className={`flex-1 text-[12px] font-semibold cursor-pointer ${sourceMode === 'account' ? 'bg-brand text-[#071117]' : 'bg-surface text-ink-soft'}`} onClick={() => setSourceMode('account')}>Account</button><button className={`flex-1 text-[12px] cursor-pointer ${sourceMode === 'complaint' ? 'bg-brand text-[#071117] font-semibold' : 'bg-surface text-ink-soft'}`} onClick={() => setSourceMode('complaint')}>Complaint ref.</button></div></div>
          <div><label className="block text-[11px] text-ink-mute mb-1.5">{sourceMode === 'account' ? 'Account ID' : 'Complaint reference'}</label><input className="input num h-9" value={sourceMode === 'account' ? accountDraft : complaintDraft} onChange={(event) => sourceMode === 'account' ? setAccountDraft(event.target.value) : setComplaintDraft(event.target.value)} placeholder={sourceMode === 'account' ? 'e.g. ACC-101' : 'e.g. NCRP-2026-06-…'} /></div>
          {sourceMode === 'account' ? <><div><label className="block text-[11px] text-ink-mute mb-1.5">Direction</label><div className="relative"><select className="input appearance-none pr-8" value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="forward">Forward · where did money go</option><option value="backward">Backward · where did money come from</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-ink-mute" /></div></div><div><label className="block text-[11px] text-ink-mute mb-1.5">Window</label><div className="relative"><select className="input appearance-none pr-8 num" value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value) as WindowDays)}>{[7, 14, 30, 90, 365].map((day) => <option key={day} value={day}>{day} days</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3 text-ink-mute" /></div></div></> : <div className="xl:col-span-2 text-[11px] text-ink-mute pb-2">Complaint traces use the complaint’s reported date and a 21-day forward window.</div>}
          <button className="btn btn-primary h-9" onClick={runTrace}><GitBranch size={14} /> Trace funds</button>
          <div className={`text-[11px] pb-2 ${statusMessage ? (status === 'stale' ? 'text-risk-mod' : 'text-risk-high') : 'text-ink-mute'}`}>{statusMessage ?? (sourceMode === 'complaint' ? 'Complaint trace remains linked to its NCRP reference.' : 'Trace parameters apply on submit.')}</div>
        </div>
      </section>

      {merged && merged.hops.length > 0 ? <>
        <div className="grid xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)] gap-5 items-start">
          <section className="border border-line bg-surface"><div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Observed path</h2><p className="text-[12px] text-ink-mute mt-1">{submitted?.direction === 'backward' ? 'Backward trace' : 'Forward trace'} · {submitted?.windowDays} day window · {merged.hops.length} qualifying hops</p></div><div className="hidden sm:flex items-center gap-3 text-[11px] text-ink-mute"><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-crit" /> score ≥ 75</span><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-risk-high" /> score ≥ 45</span></div></div><div className="p-5"><TracePath hops={merged.hops} selectedTxnId={selectedTxn?.txnId} scores={a.scores} nameOf={nameOf} onSelect={(hop) => setSelectedTxnId(hop.txnId)} /></div></section>
          <aside className="space-y-5"><section className="border border-line bg-surface"><div className="px-5 py-4 border-b border-line flex items-center justify-between"><div><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Trace endpoints</h2><p className="text-[12px] text-ink-mute mt-1">Calculated terminal inbound totals</p></div><Signpost size={17} className="text-ink-mute" /></div><div className="px-5 py-1">{merged.endpoints.length === 0 && <div className="py-4 text-[12px] text-ink-mute">No endpoint recorded in the available trace.</div>}{merged.endpoints.map((endpoint) => <div key={`${endpoint.id}-${endpoint.kind}`} className="flex items-start justify-between gap-3 py-3 border-b border-line-soft last:border-0"><div className="flex gap-3"><span className={`mt-1.5 w-2 h-2 rounded-full ${endpoint.kind === 'cash-out' ? 'bg-risk-low' : endpoint.kind === 'terminal-account' ? 'bg-risk-high' : 'bg-ink-mute'}`} /><div><div className="text-[13px] font-medium">{kindLabel(endpoint.kind)}</div><div className="text-[11px] text-ink-mute mt-0.5">{endpoint.id} · {endpoint.kind === 'cash-out' ? 'stopping point' : endpoint.kind === 'terminal-account' ? 'available trace stopping point' : 'No qualifying onward transaction'}</div></div></div><div className="num text-[12px] whitespace-nowrap">{inrFull(endpoint.amount)}</div></div>)}</div><div className="mx-5 mb-4 pt-3 border-t border-line text-[11px] leading-[1.5] text-ink-mute">Allocation follows FIFO time-ordering over observed transactions. Cumulative flow can count funds repeatedly in circular or branched flows; neither total is a proven illicit amount.</div></section>
            {selectedTxn && <section className="border border-[#2B5A64] bg-[#0F2027]"><div className="px-5 py-4 border-b border-[#2B5A64] flex items-center justify-between"><div><h2 className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Selected transaction</h2><div className="num text-[11px] text-brand mt-1">{selectedTxn.txnId}</div></div><span className="text-[10px] uppercase tracking-wider text-brand">Hop {selectedTxn.hop}</span></div><div className="px-5 py-4"><div className="flex items-center gap-2 text-[13px]"><span className="num">{selectedTxn.from}</span><ArrowRight size={14} className="text-brand" /><span className="num">{selectedTxn.to}</span></div><div className="grid grid-cols-2 gap-y-2 mt-4 text-[12px]"><span className="text-ink-mute">Time</span><span className="num text-right">{fmtDateTime(selectedTxn.ts)}</span><span className="text-ink-mute">Amount</span><span className="num text-right">{inrFull(selectedTxn.amount)}</span><span className="text-ink-mute">Channel</span><span className="text-right">{selectedTxn.channel}</span></div><div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#2B5A64]"><div className="flex gap-3"><button className="text-[11px] text-ink-soft disabled:text-ink-mute cursor-pointer disabled:cursor-not-allowed" disabled={selectedIndex <= 0} onClick={() => setSelectedTxnId(merged.hops[selectedIndex - 1]?.txnId)}><ArrowLeft size={13} className="inline" /> Previous</button><button className="text-[11px] text-ink-soft disabled:text-ink-mute cursor-pointer disabled:cursor-not-allowed" disabled={selectedIndex < 0 || selectedIndex >= merged.hops.length - 1} onClick={() => setSelectedTxnId(merged.hops[selectedIndex + 1]?.txnId)}>Next <ArrowRight size={13} className="inline" /></button></div><div className="flex gap-3"><button className="text-[11px] text-brand cursor-pointer" onClick={() => selectedTxn.to !== 'ATM' && nav(`/accounts/${selectedTxn.to}`)}>Open account</button>{selectedAccountComplaint && <button className="text-[11px] text-brand cursor-pointer" onClick={() => { setSourceMode('complaint'); setComplaintDraft(selectedAccountComplaint.ref); }}>Trace from complaint</button>}</div></div></div></section>}
          </aside>
        </div>
        <section className="mt-5 border border-line bg-surface"><div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3"><div><h2 className="text-[16px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Chronological transaction register</h2><p className="text-[12px] text-ink-mute mt-1">Showing {merged.hops.length} qualifying transactions · sorted by observed time · select a row to inspect the record</p></div><span className="num text-[11px] text-ink-mute">{merged.hops.length} hops</span></div><div className="table-scroll"><table className="table-base min-w-[900px]"><thead><tr><th>Hop</th><th>Transaction ID</th><th>Time</th><th>From</th><th>To</th><th className="text-right">Amount</th><th>Channel</th><th className="text-right">Destination score</th></tr></thead><tbody>{merged.hops.map((hop) => { const score = a.scores.get(hop.to); const selected = hop.txnId === selectedTxn?.txnId; const loop = merged.hops.some((item) => item.txnId !== hop.txnId && item.from === hop.to && item.to === hop.from); return <tr key={hop.txnId} tabIndex={0} className={`rowlink ${selected ? 'bg-brand-soft' : ''}`} onClick={() => setSelectedTxnId(hop.txnId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTxnId(hop.txnId); } }}><td className={`num text-[11px] ${selected ? 'text-brand' : ''}`}>{hop.hop}</td><td className={`num text-[11px] ${selected ? 'text-brand' : 'text-ink-soft'}`}>{hop.txnId}</td><td className="num text-[11px] whitespace-nowrap">{fmtDateTime(hop.ts)}</td><td className="num text-[12px]">{hop.from}{hop.from === submitted?.sourceValue && <span className="block text-[10px] text-ink-mute">origin</span>}</td><td className="num text-[12px]">{hop.to}{loop && <span className="text-ink-mute"> (loop)</span>}</td><td className="num text-right text-[12px]">{inrFull(hop.amount)}</td><td className="text-[12px] text-ink-soft">{hop.channel}</td><td className="num text-right text-[12px]" style={{ color: scoreColor(score?.score) }}>{score ? score.score : '—'}</td></tr>; })}</tbody></table></div><div className="px-5 py-3 border-t border-line flex flex-wrap justify-between gap-2 text-[11px] text-ink-mute"><span>Transaction IDs and timestamps are retained for checking against source records.</span><span>No account action is taken from this view.</span></div></section>
      </> : <div className="border border-line bg-surface p-12 text-center"><GitBranch size={30} className="mx-auto text-ink-mute mb-3" /><div className="text-[15px] font-semibold">{status === 'no-results' ? 'No qualifying transactions within this window.' : 'Enter a source and run the trace'}</div><div className="text-[12px] text-ink-mute mt-1 max-w-lg mx-auto">Trace output is derived from observed transaction records. A missing result is not evidence that no suspicious activity exists.</div></div>}

      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-ink-mute"><span>Scores rank suspicion for human review, not guilt.</span><button className="text-ink-soft hover:text-brand cursor-pointer" onClick={() => nav('/methodology')}>Review trace methodology</button></div>
    </div>
  );
}
