import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, FactorBars, SectionTitle, inr, inrFull, fmtDate, fmtDateTime, bandColor, Breadcrumbs, Tooltip, GlossaryTip, ConfirmModal, useToast } from '../ui';
import { loadTriage, saveTriageEntry, TRIAGE_LABELS, TRIAGE_COLORS, type TriageStatus } from '../state/triage';
import { ArrowLeft, Printer, GitBranch } from 'lucide-react';

export default function Account360({ a }: { a: Analysis }) {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const acc = a.world.accounts.find((x) => x.id === id);
  const cust = a.world.customers.find((c) => c.id === acc?.customerId);
  const score = a.scores.get(id);
  const f = a.features.get(id);
  const [tick, setTick] = useState(0);
  const triage = loadTriage()[id];
  const { showToast } = useToast();

  // Confirmation modal state for destructive / sensitive triage status changes
  const [pendingStatus, setPendingStatus] = useState<TriageStatus | null>(null);

  // Track in recent accounts
  useEffect(() => {
    if (id) {
      try {
        const stored = JSON.parse(sessionStorage.getItem('surag_recent_accounts') ?? '[]');
        const updated = [id, ...stored.filter((x: string) => x !== id)].slice(0, 8);
        sessionStorage.setItem('surag_recent_accounts', JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  }, [id]);

  const data = useMemo(() => {
    if (!acc) return null;
    const ins = a.world.txns.filter((t) => t.to === id);
    const outs = a.world.txns.filter((t) => t.from === id);
    const complaints = a.world.complaints.filter((c) => c.namedAccountIds.includes(id));
    // weekly activity series
    const weeks = new Map<number, { inflow: number; outflow: number }>();
    for (const t of ins) {
      const w = Math.floor(t.ts / (7 * 86400000));
      weeks.set(w, { inflow: (weeks.get(w)?.inflow ?? 0) + t.amount, outflow: weeks.get(w)?.outflow ?? 0 });
    }
    for (const t of outs) {
      const w = Math.floor(t.ts / (7 * 86400000));
      weeks.set(w, { inflow: weeks.get(w)?.inflow ?? 0, outflow: (weeks.get(w)?.outflow ?? 0) + t.amount });
    }
    const series = [...weeks.entries()].sort((x, y) => x[0] - y[0]).map(([w, v]) => ({ w, ...v }));
    // counterparties
    const cp = new Map<string, { inflow: number; outflow: number; count: number }>();
    for (const t of ins) cp.set(t.from, { inflow: (cp.get(t.from)?.inflow ?? 0) + t.amount, outflow: cp.get(t.from)?.outflow ?? 0, count: (cp.get(t.from)?.count ?? 0) + 1 });
    for (const t of outs) cp.set(t.to, { inflow: cp.get(t.to)?.inflow ?? 0, outflow: (cp.get(t.to)?.outflow ?? 0) + t.amount, count: (cp.get(t.to)?.count ?? 0) + 1 });
    const counterparties = [...cp.entries()].map(([cid, v]) => ({ id: cid, ...v, total: v.inflow + v.outflow })).sort((x, y) => y.total - x.total).slice(0, 10);
    // shared identifiers
    const sameDevice = a.world.accounts.filter((x) => x.id !== id && x.deviceId === acc.deviceId);
    const sameAddress = a.world.accounts.filter((x) => x.id !== id && x.addressId === acc.addressId);
    return { ins, outs, complaints, series, counterparties, sameDevice, sameAddress };
  }, [a, id, acc]);

  if (!acc || !score || !f || !data) {
    return <div className="card p-10 text-center text-sm text-ink-mute">Account not found.</div>;
  }
  const name = cust?.name ?? id;
  const maxVal = Math.max(1, ...data.series.map((s) => Math.max(s.inflow, s.outflow)));

  const applyStatusChange = (status: TriageStatus) => {
    const prevStatus = triage?.status ?? 'new';
    saveTriageEntry(id, { status, note: triage?.note ?? '', updatedAt: Date.now() });
    setTick((t) => t + 1);
    showToast(
      `Status changed to "${TRIAGE_LABELS[status]}"`,
      () => {
        saveTriageEntry(id, { status: prevStatus, note: triage?.note ?? '', updatedAt: Date.now() });
        setTick((t) => t + 1);
      },
      'Undo'
    );
  };

  const handleStatusClick = (status: TriageStatus) => {
    if (status === 'escalated' || status === 'cleared') {
      setPendingStatus(status);
    } else {
      applyStatusChange(status);
    }
  };

  return (
    <div className="max-w-[1080px]">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Alert queue', to: '/alerts' },
          { label: `${name} (${acc.id})` },
        ]}
      />

      <ConfirmModal
        open={pendingStatus !== null}
        title={pendingStatus === 'escalated' ? 'Confirm Case Escalation' : 'Confirm Account Clearance'}
        description={
          pendingStatus === 'escalated'
            ? `Are you sure you want to escalate account ${acc.id} (${name})? This marks it for external Law Enforcement Agency (LEA) referral and locks preliminary findings in the audit trail.`
            : `Are you sure you want to mark account ${acc.id} (${name}) as cleared? This indicates investigator review determined low actionable mule risk.`
        }
        confirmText={pendingStatus === 'escalated' ? 'Escalate Case' : 'Clear Account'}
        danger={pendingStatus === 'escalated'}
        onConfirm={() => {
          if (pendingStatus) applyStatusChange(pendingStatus);
          setPendingStatus(null);
        }}
        onCancel={() => setPendingStatus(null)}
      />

      <div className="flex items-center justify-between mb-4 no-print">
        <button className="btn" onClick={() => nav(-1 as never)}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="card p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[20px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {name}
              </h1>
              <ScoreBadge score={score.score} band={score.band} size="lg" />
            </div>
            <div className="num text-[12px] text-ink-mute mt-1.5">
              {acc.id} • {acc.bank} • {acc.ifsc} • {acc.type === 'current' ? 'Current' : 'Savings'} • opened {fmtDate(acc.openedAt)}
            </div>
            <div className="text-[13px] text-ink-soft mt-1">
              Observed pattern: <GlossaryTip term="pass-through" label={score.archetype} /> • {cust?.occupation}, declared income {inrFull(cust?.declaredIncome ?? 0)}/yr • {acc.city}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 no-print">
            <div className="flex gap-2">
              <Link to={`/trails?account=${id}`} className="btn no-underline">
                <GitBranch size={14} /> Trace funds
              </Link>
              <Link to={`/report/account/${id}`} className="btn no-underline">
                <Printer size={14} /> Evidence report
              </Link>
            </div>
            <div className="flex gap-1.5">
              {(Object.keys(TRIAGE_LABELS) as TriageStatus[]).map((s) => (
                <button
                  key={s}
                  className="chip cursor-pointer"
                  onClick={() => handleStatusClick(s)}
                  style={{
                    color: TRIAGE_COLORS[s],
                    background: (triage?.status ?? 'new') === s ? `${TRIAGE_COLORS[s]}22` : 'transparent',
                    borderColor: `${TRIAGE_COLORS[s]}45`,
                  }}
                  title={s === 'escalated' || s === 'cleared' ? 'Requires confirmation' : undefined}
                >
                  {TRIAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-ink-soft border-t border-line pt-3 flex items-center justify-between">
          <span>Suspicion for review only — not a finding of guilt. Corroborate with account documents and customer contact before any action.</span>
          <span className="text-[11px] text-ink-mute">Status: {TRIAGE_LABELS[triage?.status ?? 'new']}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="card p-5">
          <SectionTitle>Why this score</SectionTitle>
          <FactorBars factors={score.factors} />
        </div>
        <div className="card p-5">
          <SectionTitle>Weekly flow</SectionTitle>
          <div className="mt-2">
            <svg viewBox={`0 0 560 180`} className="w-full">
              {data.series.map((s, i) => {
                const x = 10 + i * (540 / Math.max(1, data.series.length));
                const bw = Math.max(3, 540 / Math.max(1, data.series.length) / 2 - 2);
                const hin = (s.inflow / maxVal) * 140;
                const hout = (s.outflow / maxVal) * 140;
                return (
                  <g key={s.w}>
                    <rect x={x} y={160 - hin} width={bw} height={hin} rx={1.5} fill="#2FD48C" opacity={0.75} />
                    <rect x={x + bw + 2} y={160 - hout} width={bw} height={hout} rx={1.5} fill="#FF4D5E" opacity={0.7} />
                  </g>
                );
              })}
              <line x1={8} y1={160} x2={552} y2={160} stroke="#22334E" />
            </svg>
            <div className="flex gap-4 text-[11px] text-ink-mute mt-1">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#2FD48C', opacity: 0.75 }} /> Inflow</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#FF4D5E', opacity: 0.7 }} /> Outflow</span>
              <span className="ml-auto num">peak week {inr(maxVal)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div>
              <div className="num text-[16px] font-semibold">{inr(f.inTotal)}</div>
              <Tooltip text="Total INR credits received during the monitored period">
                <div className="text-[11px] text-ink-mute cursor-help">Total inflow ⓘ</div>
              </Tooltip>
            </div>
            <div>
              <div className="num text-[16px] font-semibold">{Math.round(f.passThrough24h * 100)}%</div>
              <Tooltip text="Percentage of funds transferred out within 24 hours of arrival (pass-through velocity)">
                <div className="text-[11px] text-ink-mute cursor-help">Out within 24h ⓘ</div>
              </Tooltip>
            </div>
            <div>
              <div className="num text-[16px] font-semibold">{f.medianHoldHours > 0 ? `${f.medianHoldHours.toFixed(1)}h` : '-'}</div>
              <Tooltip text="Median hours money stays in account before being dispatched to downstream accounts">
                <div className="text-[11px] text-ink-mute cursor-help">Median hold ⓘ</div>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <SectionTitle>Top counterparties</SectionTitle>
          <div className="space-y-1.5">
            {data.counterparties.map((c) => {
              const cpScore = a.scores.get(c.id);
              const cpAcc = a.world.accounts.find((x) => x.id === c.id);
              const cpName = c.id === 'ATM' ? 'ATM cash withdrawal' : a.world.customers.find((x) => x.id === cpAcc?.customerId)?.name ?? c.id;
              return (
                <div key={c.id} className={`flex items-center gap-3 p-2 rounded-lg ${c.id !== 'ATM' ? 'rowlink' : ''}`} onClick={() => c.id !== 'ATM' && nav(`/accounts/${c.id}`)}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{cpName}</div>
                    <div className="num text-[11px] text-ink-mute">{c.id} - {c.count} txn{c.count > 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[12px]">{inr(c.total)}</div>
                    {cpScore && <div className="num text-[11px]" style={{ color: bandColor(cpScore.band) }}>score {cpScore.score}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <SectionTitle>Linked complaints ({data.complaints.length})</SectionTitle>
            {data.complaints.length === 0 && <div className="text-[13px] text-ink-mute">No cybercrime complaint names this account.</div>}
            {data.complaints.map((c) => (
              <div key={c.id} className="p-2.5 rounded-lg border border-line mb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold">{c.category}</span>
                  <span className="num text-[12px] text-ink-soft">{inrFull(c.amountLost)}</span>
                </div>
                <div className="num text-[11px] text-ink-mute mt-0.5">{c.ref} - reported {fmtDate(c.reportedAt)} - {c.city}</div>
                <div className="text-[12px] text-ink-soft mt-1">{c.summary}</div>
              </div>
            ))}
          </div>
          <div className="card p-4">
            <SectionTitle>Shared identifiers</SectionTitle>
            <div className="text-[13px] space-y-2">
              <div className="flex justify-between"><span className="text-ink-soft">Device</span><span className="num text-[12px]">{acc.deviceId}</span></div>
              <div className="text-[12px] text-ink-soft">{data.sameDevice.length === 0 ? 'No other account uses this device.' : `Also used by: ${data.sameDevice.map((x) => x.id).join(', ')}`}</div>
              <div className="flex justify-between"><span className="text-ink-soft">Address</span><span className="num text-[12px]">{acc.addressId}</span></div>
              <div className="text-[12px] text-ink-soft">{data.sameAddress.length === 0 ? 'No other account at this address.' : `Also registered to: ${data.sameAddress.map((x) => x.id).join(', ')}`}</div>
              <div className="flex justify-between"><span className="text-ink-soft">Phone</span><span className="num text-[12px]">{acc.phone}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
