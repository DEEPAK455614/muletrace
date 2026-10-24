import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Analysis } from '../engine';
import { ScoreBadge, inr } from '../ui';
import { loadTriage, TRIAGE_LABELS, TRIAGE_COLORS } from '../state/triage';

type Filter = 'all' | 'complaint' | 'critical' | 'untriaged';

export default function Alerts({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [band, setBand] = useState<string>('all');
  const triage = loadTriage();

  const rows = useMemo(() => {
    let rs = [...a.scores.values()].filter((s) => s.score >= 45);
    if (filter === 'complaint') rs = rs.filter((s) => (a.features.get(s.accountId)?.complaintDistance ?? 99) === 0);
    if (filter === 'critical') rs = rs.filter((s) => s.score >= 75);
    if (filter === 'untriaged') rs = rs.filter((s) => !triage[s.accountId] || triage[s.accountId].status === 'new');
    if (band !== 'all') rs = rs.filter((s) => s.band === band);
    return rs.sort((x, y) => y.score - x.score);
  }, [a, filter, band]);

  const custName = (id: string) => {
    const acc = a.world.accounts.find((x) => x.id === id);
    return a.world.customers.find((c) => c.id === acc?.customerId)?.name ?? id;
  };
  const topFactors = (id: string) =>
    (a.scores.get(id)?.factors ?? []).sort((x, y) => y.points - x.points).slice(0, 2).map((f) => f.label).join(' + ');

  const FILTERS: { k: Filter; label: string }[] = [
    { k: 'all', label: 'All alerts' },
    { k: 'complaint', label: 'Complaint-named' },
    { k: 'critical', label: 'Critical only' },
    { k: 'untriaged', label: 'Untriaged' },
  ];

  return (
    <div className="max-w-[1080px]">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Alert queue</h1>
        <p className="text-[13px] text-ink-soft mt-1">
          Accounts scoring in the High or Critical band, ranked for investigator review. Scores rank suspicion for review; they are not findings of guilt. Analyst capacity is the real constraint - work the queue top-down.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button key={f.k} className="btn" onClick={() => setFilter(f.k)}
            style={filter === f.k ? { background: 'var(--color-brand)', color: '#fff', borderColor: 'var(--color-brand)' } : {}}>
            {f.label}
          </button>
        ))}
        <select className="btn" value={band} onChange={(e) => setBand(e.target.value)} aria-label="Band filter">
          <option value="all">All bands</option>
          <option>Critical</option>
          <option>High</option>
        </select>
        <span className="text-[12px] text-ink-mute ml-auto num">{rows.length} in queue</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base min-w-[760px]">
          <thead>
            <tr><th>Account</th><th>Observed pattern</th><th>Top indicators</th><th>Complaint</th><th>Triage</th><th className="text-right">Inflow</th><th className="text-right">Score</th></tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const f = a.features.get(s.accountId)!;
              const t = triage[s.accountId];
              return (
                <tr key={s.accountId} className="rowlink" onClick={() => nav(`/accounts/${s.accountId}`)}>
                  <td>
                    <div className="font-medium text-[13px]">{custName(s.accountId)}</div>
                    <div className="num text-[11px] text-ink-mute">{s.accountId}</div>
                  </td>
                  <td className="text-[12px] text-ink-soft max-w-[150px]">{s.archetype}</td>
                  <td className="text-[12px] text-ink-soft max-w-[210px]">{topFactors(s.accountId)}</td>
                  <td>{f.complaintDistance === 0 ? <span className="chip" style={{ color: 'var(--color-risk-crit)', background: '#D92D2012', borderColor: '#D92D2030' }}>Named</span> : f.complaintDistance === 1 ? <span className="chip" style={{ color: 'var(--color-risk-high)', background: '#E0651F12', borderColor: '#E0651F30' }}>1 hop</span> : <span className="text-[12px] text-ink-mute">-</span>}</td>
                  <td><span className="chip" style={{ color: TRIAGE_COLORS[t?.status ?? 'new'], background: `${TRIAGE_COLORS[t?.status ?? 'new']}12`, borderColor: `${TRIAGE_COLORS[t?.status ?? 'new']}30` }}>{TRIAGE_LABELS[t?.status ?? 'new']}</span></td>
                  <td className="num text-right text-[12px]">{inr(f.inTotal)}</td>
                  <td className="text-right"><ScoreBadge score={s.score} band={s.band} size="sm" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-10 text-center text-sm text-ink-mute">No alerts match this filter.</div>}
      </div>
    </div>
  );
}
