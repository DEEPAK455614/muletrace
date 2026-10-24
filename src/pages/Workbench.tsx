import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Analysis } from '../engine';
import { analyze } from '../engine';
import { featureVector, trainLogReg, predictProb, FEATURE_KEYS, type LogRegModel } from '../engine/ml';
import { buildCommunities, buildLayout, BAND_FILL } from '../components/FlowGraph';
import FlowGraph from '../components/FlowGraph';
import { ScoreBadge, FactorBars, inr, inrFull, fmtDate, fmtDateTime } from '../ui';
import { loadTriage, saveTriageEntry, TRIAGE_LABELS, TRIAGE_COLORS, type TriageStatus } from '../state/triage';
import { Search, AlertTriangle, GitBranch, FileText, ExternalLink, X } from 'lucide-react';

const FEATURE_LABEL: Record<string, string> = {
  inCount: 'Inbound transaction count', outCount: 'Outbound transaction count',
  distinctSources: 'Distinct senders', distinctDests: 'Distinct recipients',
  passThrough24h: 'Funds moved out within 24h', passThrough72h: 'Funds moved out within 72h',
  merchantSpendShare: 'Ordinary merchant spend share', aggregationConcentration: 'Aggregation concentration',
  medianHoldHours: 'Median hold time (hours)', maxTxnsInHour: 'Peak transactions in one hour',
  maxTxnsInDay: 'Peak transactions in one day', medianTxnsPerActiveDay: 'Typical transactions per active day',
  newCounterpartyShare: 'New-counterparty share', longestDormancyDays: 'Longest dormancy (days)',
  burstAfterDormancy: 'Burst after dormancy', structuredDepositShare: 'Structured-deposit share',
  structuredDepositCount: 'Structured-deposit count', atmShareOut: 'Cash-out (ATM) share',
  annualizedThroughput: 'Annualised throughput', incomeMultiple: 'Throughput vs declared income',
  accountAgeDaysAtEnd: 'Account age (days)', complaintDistance: 'Complaint proximity',
  maxComplaintAmountLost: 'Linked complaint loss', sharedDeviceCount: 'Shared devices',
  sharedAddressCount: 'Shared addresses', sharesIdentifierWithComplaintLinked: 'Shared identifier with complaint-linked account',
  cycleSize: 'Circular-flow cycle size', communityMeanSignal: 'Community mean signal', pagerank: 'Graph centrality (PageRank)',
};

type MlState = { model: LogRegModel; trainedSeed: string };
let mlCache: MlState | null = null;
function getMlModel(): MlState {
  if (!mlCache) {
    const dev = analyze(); // dev seed = muletrace-v1 (same generator world as the demo dataset)
    const ids = [...dev.features.keys()];
    const X = ids.map((id) => featureVector(dev.features.get(id)!));
    const y = ids.map((id) => (dev.world.groundTruth[id] ? 1 : 0));
    mlCache = { model: trainLogReg(X, y, 'muletrace-v1'), trainedSeed: 'muletrace-v1' };
  }
  return mlCache;
}

function mlContributions(model: LogRegModel, f: Parameters<typeof featureVector>[0]) {
  const v = featureVector(f);
  return model.featureKeys.map((k, j) => {
    const z = (v[j] - model.mean[j]) / model.std[j];
    return { key: k, label: FEATURE_LABEL[k] ?? k, contribution: model.weights[j] * z };
  }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

type FilterKey = 'all' | 'complaint' | 'new' | 'escalated';

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(660);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(Math.max(320, Math.round(es[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

export default function Workbench({ a, uploaded }: { a: Analysis; uploaded: boolean }) {
  const communities = useMemo(() => buildCommunities(a), [a]);
  const [cid, setCid] = useState<number | null>(null);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => params.get('account'));
  const paramAccount = params.get('account');
  useEffect(() => {
    if (paramAccount) setSelected((cur) => (cur === paramAccount ? cur : paramAccount));
  }, [paramAccount]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [scorer, setScorer] = useState<'rules' | 'ml'>('rules');
  const [triage, setTriage] = useState(() => loadTriage());

  const graphBox = useWidth();
  const gw = graphBox.w, gh = Math.max(430, Math.round(gw * 0.72));
  const activeCid = cid ?? communities[0]?.cid ?? 0;
  const activeCommunity = communities.find((c) => c.cid === activeCid) ?? communities[0];
  const layout = useMemo(
    () => (activeCommunity ? buildLayout(a, activeCommunity.members, gw, gh) : null),
    [a, activeCommunity, gw, gh],
  );

  const ranked = useMemo(() => {
    const rows = [...a.scores.values()]
      .map((s) => {
        const f = a.features.get(s.accountId);
        const acc = a.world.accounts.find((x) => x.id === s.accountId);
        const name = a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? s.accountId;
        const complaint = a.world.complaints.some((c) => c.namedAccountIds.includes(s.accountId));
        const topFactor = s.factors.filter((x) => x.key !== 'community').sort((x, y) => y.points - x.points)[0];
        return { s, f, name, complaint, topFactor };
      })
      .sort((x, y) => y.s.score - x.s.score);
    return rows;
  }, [a]);

  const filtered = useMemo(() => ranked.filter((r) => {
    if (filter === 'complaint' && !r.complaint) return false;
    if (filter === 'new' && (triage[r.s.accountId]?.status ?? 'new') !== 'new') return false;
    if (filter === 'escalated' && triage[r.s.accountId]?.status !== 'escalated') return false;
    if (query) {
      const q = query.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.s.accountId.toLowerCase().includes(q)) return false;
    }
    return true;
  }).slice(0, 60), [ranked, filter, query, triage]);

  const sel = selected ? a.scores.get(selected) : null;
  const selFeatures = selected ? a.features.get(selected) : null;
  const selAccount = selected ? a.world.accounts.find((x) => x.id === selected) : null;
  const selName = selAccount ? (a.world.customers.find((c) => c.id === selAccount.customerId)?.name ?? selected!) : '';
  const selComplaints = useMemo(
    () => (selected ? a.world.complaints.filter((c) => c.namedAccountIds.includes(selected)) : []),
    [a, selected],
  );
  const partyName = (id: string) => id === 'EXT' ? 'External source' : id === 'ATM' ? 'Cash withdrawal' :
    (a.world.customers.find((c) => c.id === a.world.accounts.find((x) => x.id === id)?.customerId)?.name ?? id);

  const selCounterparties = useMemo(() => {
    if (!selected) return { ins: [], outs: [] };
    const agg = new Map<string, { in: number; out: number }>();
    for (const t of a.world.txns) {
      if (t.to === selected) { const e = agg.get(t.from) ?? { in: 0, out: 0 }; e.in += t.amount; agg.set(t.from, e); }
      if (t.from === selected) { const e = agg.get(t.to) ?? { in: 0, out: 0 }; e.out += t.amount; agg.set(t.to, e); }
    }
    const rows = [...agg.entries()].map(([id, v]) => ({ id, name: partyName(id), ...v }));
    return {
      ins: rows.filter((r) => r.in > 0).sort((x, y) => y.in - x.in).slice(0, 5),
      outs: rows.filter((r) => r.out > 0).sort((x, y) => y.out - x.out).slice(0, 5),
    };
  }, [a, selected]);

  const selTimeline = useMemo(() => {
    if (!selected) return [];
    return a.world.txns
      .filter((t) => t.from === selected || t.to === selected)
      .sort((x, y) => x.ts - y.ts)
      .map((t) => ({ ...t, dir: t.to === selected ? ('in' as const) : ('out' as const), other: t.to === selected ? t.from : t.to }));
  }, [a, selected]);

  const ml = scorer === 'ml' ? getMlModel() : null;
  const selMlProb = ml && selFeatures ? predictProb(ml.model, selFeatures) : null;
  const selMlContribs = ml && selFeatures ? mlContributions(ml.model, selFeatures) : null;

  const setStatus = (id: string, status: TriageStatus) => {
    const entry = { status, note: '', updatedAt: Date.now() };
    saveTriageEntry(id, entry);
    setTriage((t) => ({ ...t, [id]: entry }));
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-7rem)] min-h-0">
      {/* Queue */}
      <div className="w-full md:w-[300px] shrink-0 flex flex-col min-h-0 card p-0 overflow-hidden max-h-[420px] md:max-h-none">
        <div className="p-3 border-b border-[#1A2537]">
          <div className="flex items-center gap-2 bg-[#0E1626] rounded-lg px-2.5 py-2 border border-[#1A2537]">
            <Search size={14} className="text-ink-mute shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or account"
              className="bg-transparent outline-none text-[12.5px] w-full placeholder:text-ink-mute" />
          </div>
          <div className="flex gap-1.5 mt-2.5 flex-wrap">
            {([['all', 'All'], ['complaint', 'Complaint-linked'], ['new', 'New'], ['escalated', 'Escalated']] as [FilterKey, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${filter === k ? 'border-brand text-brand bg-[#2CD9FF10]' : 'border-[#1A2537] text-ink-mute hover:text-ink-soft'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {filtered.map((r) => {
            const st = triage[r.s.accountId]?.status ?? 'new';
            const isSel = selected === r.s.accountId;
            return (
              <button key={r.s.accountId} onClick={() => setSelected(isSel ? null : r.s.accountId)}
                className={`w-full text-left px-3 py-2.5 border-b border-[#141E30] transition-colors ${isSel ? 'bg-[#2CD9FF12]' : 'hover:bg-[#131E33]'}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BAND_FILL[r.s.band] ?? '#5E7191' }} />
                  <span className="text-[12.5px] font-medium truncate">{r.name}</span>
                  {r.complaint && <AlertTriangle size={12} className="text-risk-crit shrink-0" />}
                  <span className="ml-auto num text-[12.5px] font-semibold shrink-0" style={{ color: BAND_FILL[r.s.band] ?? '#5E7191' }}>{r.s.score}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 pl-4">
                  <span className="text-[10.5px] text-ink-mute truncate">{r.s.accountId}{r.topFactor ? ` - ${r.topFactor.label}` : ''}</span>
                  <span className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ color: TRIAGE_COLORS[st], background: `${TRIAGE_COLORS[st]}18` }}>{TRIAGE_LABELS[st]}</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="p-4 text-[12px] text-ink-mute">No accounts match this filter.</div>}
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 min-w-0 flex flex-col min-h-[480px] md:min-h-0 card p-3 overflow-hidden">
        <div className="flex gap-1.5 flex-wrap mb-1">
          {communities.slice(0, 8).map((c) => (
            <button key={c.cid} onClick={() => setCid(c.cid)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${activeCid === c.cid ? 'border-brand text-brand bg-[#2CD9FF10]' : 'border-[#1A2537] text-ink-mute hover:text-ink-soft'}`}>
              #{c.cid} peak {Math.round(c.maxScore)}{c.complaints.length > 0 ? ` - ${c.complaints.length} complaint${c.complaints.length > 1 ? 's' : ''}` : ''}
            </button>
          ))}
        </div>
        {layout ? (
          <div ref={graphBox.ref} className="flex-1 min-h-0 flex flex-col">
            <FlowGraph layout={layout} selNode={selected}
              onSelectNode={(id) => setSelected(id)} width={gw} height={gh} labelScale={gw >= 900 ? 1.2 : gw >= 620 ? 1.1 : 1} />
            <div className="text-[10.5px] text-ink-mute mt-1.5 leading-relaxed">
              Communities from the transaction graph (Louvain), ranked by peak member risk. Structure is shown for investigator review - it does not establish any person's role. Select a node to open its evidence panel.
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12.5px] text-ink-mute text-center px-6">
            No transaction community meets the display threshold under the current rules. This is not evidence that no suspicious activity exists - review the queue on the left, which lists every scored account.
          </div>
        )}
      </div>

      {/* Evidence panel */}
      {sel && selFeatures && (
        <div className="w-full md:w-[380px] shrink-0 flex flex-col min-h-0 card p-0 overflow-hidden max-h-[70vh] md:max-h-none">
          <div className="p-4 border-b border-[#1A2537]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-semibold">{selName}</div>
                <div className="text-[11px] text-ink-mute mt-0.5">{selected} - community #{selFeatures.communityId}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-mute hover:text-ink-soft"><X size={16} /></button>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <ScoreBadge score={scorer === 'ml' && selMlProb != null ? (selMlProb >= 0.99 ? Math.min(99.9, Math.floor(selMlProb * 1000) / 10) : Math.round(selMlProb * 100)) : sel.score}
                band={scorer === 'ml' ? 'ML' : sel.band} size="lg" />
              <div className="text-[11px] text-ink-mute leading-snug">
                {scorer === 'ml'
                  ? 'ML model output (logistic regression score, 0-100). Class-weighted training on synthetic data - not a calibrated real-world probability. Model attribution, not evidence.'
                  : <>Rules score - {sel.archetype}. Every point is a named, weighted factor below.</>}
              </div>
            </div>
            <div className="flex gap-1.5 mt-3">
              {(['new', 'review', 'escalated', 'cleared'] as TriageStatus[]).map((st) => {
                const cur = (triage[selected!]?.status ?? 'new') === st;
                return (
                  <button key={st} onClick={() => setStatus(selected!, st)}
                    className={`text-[10.5px] px-2 py-1 rounded-full border transition-colors ${cur ? 'font-semibold' : 'text-ink-mute hover:text-ink-soft'}`}
                    style={cur ? { color: TRIAGE_COLORS[st], borderColor: TRIAGE_COLORS[st], background: `${TRIAGE_COLORS[st]}14` } : { borderColor: '#1A2537' }}>
                    {TRIAGE_LABELS[st]}
                  </button>
                );
              })}
            </div>
            <div className="text-[9.5px] text-ink-mute mt-1.5">Triage changes are recorded in the audit trail.</div>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-4">
            <div className="flex gap-1.5 p-0.5 rounded-lg bg-[#0E1626] border border-[#1A2537] w-fit">
              {([['rules', 'Rules (operational)'], ['ml', 'ML model']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setScorer(k)}
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${scorer === k ? 'bg-[#1B2B47] text-ink font-medium' : 'text-ink-mute hover:text-ink-soft'}`}>
                  {label}
                </button>
              ))}
            </div>

            {scorer === 'rules' ? (
              <FactorBars factors={sel.factors} />
            ) : (
              <div>
                <div className="text-[12px] font-semibold mb-1.5">Top model contributions</div>
                <div className="text-[10.5px] text-ink-mute leading-relaxed mb-2">
                  Weight x standardised feature value, ranked by size. Positive pushes the probability up, negative pulls it down. This is the model's own attribution - it is not observed evidence.
                </div>
                {(selMlContribs ?? []).slice(0, 6).map((c) => (
                  <div key={c.key} className="flex items-center gap-2 py-1">
                    <span className="text-[11px] flex-1 truncate">{c.label}</span>
                    <span className="num text-[11px] font-medium" style={{ color: c.contribution >= 0 ? '#FF7A45' : '#2FD48C' }}>
                      {c.contribution >= 0 ? '+' : ''}{c.contribution.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="text-[9.5px] text-ink-mute leading-relaxed mt-2 border-t border-[#1A2537] pt-2">
                  {uploaded
                    ? 'Model trained on the synthetic demo world only, with class-weighted fitting - the output measures synthetic discrimination, not a calibrated probability. Uploaded data is unverified - indicative ranking only, not a validated risk estimate.'
                    : 'Model trained on this synthetic demo world\'s generator labels (dev world) - in-sample here, and class-weighted, so the number measures synthetic discrimination, not a calibrated probability. Untouched-holdout results are on the Evaluation page. Not validated on real banking data.'}
                </div>
              </div>
            )}

            {selComplaints.length > 0 && (
              <div>
                <div className="text-[12px] font-semibold mb-1.5">Linked complaints ({selComplaints.length})</div>
                {selComplaints.map((c) => (
                  <div key={c.id} className="bg-[#0E1626] border border-[#1A2537] rounded-lg p-2.5 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] font-medium">{c.category}</span>
                      <span className="ml-auto num text-[11.5px] text-risk-crit font-semibold">{inrFull(c.amountLost)}</span>
                    </div>
                    <div className="text-[10px] text-ink-mute mt-0.5">{c.ref} - reported {fmtDate(c.reportedAt)} - {c.city}</div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="text-[12px] font-semibold mb-1.5">Top counterparties</div>
              {selCounterparties.ins.slice(0, 3).map((r) => (
                <div key={`in-${r.id}`} className="flex items-center gap-2 py-0.5">
                  <span className="text-[11px] text-ink-soft truncate flex-1">from {r.name}</span>
                  <span className="num text-[11px]">{inr(r.in)}</span>
                </div>
              ))}
              {selCounterparties.outs.slice(0, 3).map((r) => (
                <div key={`out-${r.id}`} className="flex items-center gap-2 py-0.5">
                  <span className="text-[11px] text-ink-soft truncate flex-1">to {r.name}</span>
                  <span className="num text-[11px]">{inr(r.out)}</span>
                </div>
              ))}
            </div>

            <div>
              <div className="text-[12px] font-semibold mb-1">Transaction timeline (chronological)</div>
              <div className="text-[10px] text-ink-mute mb-1.5">
                {selTimeline.length} transaction{selTimeline.length === 1 ? '' : 's'} in the analysis window{selTimeline.length > 40 ? ' - showing earliest 40' : ''}.
              </div>
              <div className="max-h-[260px] overflow-y-auto pr-1">
                {selTimeline.slice(0, 40).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 py-1 border-b border-[#141E30] last:border-0">
                    <span className="num text-[10px] text-ink-mute w-[92px] shrink-0">{fmtDateTime(t.ts)}</span>
                    <span className="text-[11px] font-semibold shrink-0 w-4 text-center" style={{ color: t.dir === 'in' ? '#2FD48C' : '#FF7A45' }}>{t.dir === 'in' ? '\u2193' : '\u2191'}</span>
                    <span className="text-[11px] text-ink-soft truncate flex-1">{partyName(t.other)}</span>
                    <span className="text-[9.5px] text-ink-mute shrink-0">{t.channel}</span>
                    <span className="num text-[11px] shrink-0">{inr(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-[#1A2537]">
              <Link to={`/accounts/${selected}`} className="btn no-underline flex items-center gap-1.5 text-[12px]"><ExternalLink size={13} /> Account 360</Link>
              <Link to={`/trails?account=${selected}`} className="btn no-underline flex items-center gap-1.5 text-[12px]"><GitBranch size={13} /> Trace money trail</Link>
              <Link to={`/report/account/${selected}`} className="btn no-underline flex items-center gap-1.5 text-[12px]"><FileText size={13} /> Evidence report</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
